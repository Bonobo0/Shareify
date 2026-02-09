"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import ShareModal from "@/app/components/shareModal";
import { useAuth } from "@/context/AuthContext";
import {
  getFileDetails,
  getFileDownloadUrl,
  deleteFile,
} from "@/actions/files";
import { toggleFilePublic } from "@/actions/share";
import { downloadAndDecrypt, isMediaFile } from "@/lib/crypto/encryption";
import { createPreviewUrl } from "@/lib/downloadUtils";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faLock, faUser, faDownload, faPenToSquare, faEye, faUpload, faTrash, faHouse, faGamepad } from "@fortawesome/free-solid-svg-icons";

const LiveEditor = dynamic(() => import("@/app/components/liveEditor"), {
  ssr: false,
  loading: () => (
    <div className="flex flex-col items-center justify-center py-12 gap-3">
      <span className="loading loading-spinner loading-lg"></span>
      <p className="text-sm opacity-60">에디터 로딩 중...</p>
    </div>
  ),
});

export default function FilePage() {
  const params = useParams();
  const router = useRouter();
  const { hash } = params;
  const { user, loading: authLoading, isAuthenticated } = useAuth();

  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [isOwner, setIsOwner] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [decryptModal, setDecryptModal] = useState(false);
  const [decryptPassword, setDecryptPassword] = useState("");
  const [previewModal, setPreviewModal] = useState(null);
  const [downloadLoading, setDownloadLoading] = useState(false);
  const [previewDecryptModal, setPreviewDecryptModal] = useState(false);
  const [previewDecryptPassword, setPreviewDecryptPassword] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);

  // 모달 상태들
  const [alertModal, setAlertModal] = useState({ show: false, message: "" });
  const [confirmModal, setConfirmModal] = useState({
    show: false,
    message: "",
    onConfirm: null,
  });

  // 헬퍼 함수들
  const showAlert = (message) => {
    setAlertModal({ show: true, message });
  };

  const showConfirm = (message, onConfirm) => {
    setConfirmModal({ show: true, message, onConfirm });
  };

  const fetchFileDetails = useCallback(async () => {
    try {
      const result = await getFileDetails({ hash });

      if (result.error) {
        throw new Error(result.error);
      }

      if (result.success) {
        setFile(result.file);
        setIsPublic(result.file.isPublic);
        setIsOwner(result.file.userPermission === "admin");

        if (result.file.isPublic) {
          setShareUrl(`${window.location.origin}/share/${hash}`);
        }
      }
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  }, [hash]);

  useEffect(() => {
    if (authLoading) return;

    if (!isAuthenticated) {
      router.push("/user/signin");
      return;
    }

    if (hash) {
      fetchFileDetails();
    }
  }, [hash, isAuthenticated, authLoading, router, fetchFileDetails]);

  const handleDownload = async () => {
    if (file?.isEncrypted) {
      setDecryptModal(true);
      return;
    }

    setDownloadLoading(true);
    try {
      const result = await getFileDownloadUrl({ fileId: file.id });

      if (result.error) {
        throw new Error(result.error);
      }

      if (result.success) {
        // 일반 파일 다운로드
        const link = document.createElement("a");
        link.href = result.downloadUrl;
        link.download = file.originalName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (error) {
      showAlert(error.message);
    } finally {
      setDownloadLoading(false);
    }
  };

  const handleEncryptedDownload = async () => {
    if (!decryptPassword) {
      showAlert("복호화 키를 입력해주세요.");
      return;
    }

    setDownloadLoading(true);
    try {
      const result = await getFileDownloadUrl({ fileId: file.id });

      if (result.error) {
        throw new Error(result.error);
      }

      const metadata = {
        originalName: file.originalName,
        originalType: file.originalMimetype,
        originalSize: file.originalSize,
      };

      const downloadResult = await downloadAndDecrypt(
        result.downloadUrl,
        decryptPassword,
        metadata,
      );

      if (downloadResult.error) {
        showAlert(downloadResult.error);
        return;
      }

      setDecryptModal(false);
      setDecryptPassword("");
    } catch (error) {
      showAlert("복호화 및 다운로드 중 오류가 발생했습니다.");
    } finally {
      setDownloadLoading(false);
    }
  };

  const handlePreview = async () => {
    if (!file?.isEncrypted) {
      // 일반 파일 미리보기
      try {
        const result = await getFileDownloadUrl({
          fileId: file.id,
          asPreview: true,
        });
        if (result.error) {
          showAlert(result.error);
          return;
        }
        const isPdfOrTextOrEjtxt =
          file.mimetype?.startsWith("application/pdf") ||
          file.originalMimetype?.startsWith("application/pdf") ||
          file.mimetype?.startsWith("text/") ||
          file.originalMimetype?.startsWith("text/") ||
          file.originalName?.endsWith(".ejtxt");
        const previewResult = await createPreviewUrl({
          downloadUrl: result.downloadUrl,
          forceBlob: isPdfOrTextOrEjtxt,
        });

        if (previewResult.error) {
          throw new Error(previewResult.error);
        }

        setPreviewModal({ file, url: previewResult.url });
      } catch (err) {
        showAlert("미리보기를 불러올 수 없습니다.");
      }
      return;
    }

    // 암호화된 파일 미리보기 - 모달 표시
    setPreviewDecryptModal(true);
  };

  const handlePreviewDecrypt = async () => {
    if (!previewDecryptPassword) {
      showAlert("복호화 키를 입력해주세요.");
      return;
    }

    setPreviewLoading(true);

    try {
      const result = await getFileDownloadUrl({
        fileId: file.id,
        asPreview: true,
      });
      if (result.error) {
        showAlert(result.error);
        return;
      }

      const previewResult = await createPreviewUrl({
        downloadUrl: result.downloadUrl,
        isEncrypted: true,
        password: previewDecryptPassword,
        metadata: {
          originalName: file.originalName,
          originalMimetype: file.originalMimetype,
        },
      });

      if (previewResult.error) {
        showAlert(previewResult.error);
        return;
      }

      setPreviewModal({ file, url: previewResult.url });

      // 성공 후 모달 닫기 및 초기화
      setPreviewDecryptModal(false);
      setPreviewDecryptPassword("");
    } catch (err) {
      showAlert("미리보기 생성 중 오류가 발생했습니다.");
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleFileUpdate = useCallback(async () => {
    // 파일 정보를 다시 가져와서 상태 동기화
    try {
      const result = await getFileDetails({ hash });

      if (result.success) {
        setFile(result.file);
        setIsPublic(result.file.isPublic);

        if (result.file.isPublic) {
          setShareUrl(`${window.location.origin}/share/${hash}`);
        } else {
          setShareUrl("");
        }
      }
    } catch (error) {
      console.error("파일 정보 업데이트 오류:", error);
    }
  }, [hash]);

  const togglePublicAccess = async () => {
    if (!isOwner) return;

    try {
      const result = await toggleFilePublic({ fileId: file.id });

      if (result.error) {
        throw new Error(result.error);
      }

      if (result.success) {
        setIsPublic(result.isPublic);

        if (result.isPublic) {
          setShareUrl(`${window.location.origin}/share/${hash}`);
        } else {
          setShareUrl("");
        }
      }
    } catch (error) {
      showAlert(error.message);
    }
  };

  const formatBytes = (bytes, decimals = 2) => {
    if (!bytes) return "0 Bytes";

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
  };

  const formatDate = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const copyShareUrl = () => {
    navigator.clipboard.writeText(shareUrl);
    showAlert("공유 링크가 클립보드에 복사되었습니다.");
  };

  const handleDeleteFile = async () => {
    if (!isOwner) return;

    showConfirm("정말 이 파일을 삭제하시겠습니까?", async () => {
      try {
        const result = await deleteFile({ fileId: file.id });

        if (result.error) {
          throw new Error(result.error);
        }

        if (result.success) {
          showAlert(result.message || "파일이 삭제되었습니다.");
          setTimeout(() => {
            router.back();
          }, 1500);
        }
      } catch (error) {
        showAlert(error.message);
      }
    });
  };

  if (authLoading || loading) {
    return (
      <>
        <main className="flex min-h-screen flex-col items-center justify-center">
          <div className="loading loading-spinner loading-lg"></div>
        </main>
      </>
    );
  }

  if (error) {
    return (
      <>
        <main className="flex min-h-screen flex-col p-8">
          <div className="alert alert-error">{error}</div>
          <button
            className="btn btn-primary mt-4"
            onClick={() => router.push("/dashboard")}
          >
            대시보드로 돌아가기
          </button>
        </main>
      </>
    );
  }

  return (
    <>
      <main className="flex min-h-screen flex-col p-2 sm:p-4 md:p-8">
        <div className="breadcrumbs mb-4 text-xs sm:text-sm">
          <ul>
            <li>
              <button onClick={() => router.push("/dashboard")}>내 파일</button>
            </li>
            <li className="truncate max-w-[200px] sm:max-w-none">
              {file?.originalName}
            </li>
          </ul>
        </div>

        <div className="card bg-base-200 p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold break-words min-w-0 flex-1">
              {file?.originalName}
            </h1>
            <div className="flex flex-wrap items-center gap-1 sm:gap-2">
              {file?.isEncrypted && (
                <div className="badge badge-primary badge-xs sm:badge-sm whitespace-nowrap">
                  <FontAwesomeIcon icon={faLock} /> 암호화됨
                </div>
              )}
              {file?.isWebGLBuild && (
                <div className="badge badge-secondary badge-xs sm:badge-sm whitespace-nowrap">
                  <FontAwesomeIcon icon={faGamepad} /> WebGL 게임
                </div>
              )}
              {file?.isPublic && (
                <div className="badge badge-success badge-xs sm:badge-sm whitespace-nowrap">
                  공개
                </div>
              )}
              {!isOwner && file?.owner && (
                <div className="badge badge-accent badge-xs sm:badge-sm gap-1 whitespace-nowrap">
                  <span><FontAwesomeIcon icon={faUser} /></span>
                  <span className="truncate max-w-[80px] sm:max-w-none text-xs sm:text-sm">
                    {file.owner.name || file.owner.email}님이 공유
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 sm:mb-6">
            <div>
              <h2 className="text-base sm:text-lg font-semibold mb-2">
                파일 정보
              </h2>
              <ul className="space-y-1 sm:space-y-2 text-sm sm:text-base">
                <li>
                  <strong>크기:</strong>{" "}
                  {formatBytes(
                    file?.isEncrypted ? file?.originalSize : file?.size,
                  )}
                </li>
                <li>
                  <strong>유형:</strong>{" "}
                  <span className="break-all">
                    {file?.isEncrypted
                      ? file?.originalMimetype
                      : file?.mimetype}
                  </span>
                </li>
                <li>
                  <strong>업로드 일시:</strong>{" "}
                  <span className="text-xs sm:text-sm">
                    {formatDate(file?.createdAt)}
                  </span>
                </li>
              </ul>
            </div>

            {isOwner && (
              <div>
                <h2 className="text-base sm:text-lg font-semibold mb-2">
                  액세스 설정
                </h2>
                <div className="form-control">
                  <label className="label cursor-pointer">
                    <span className="label-text text-sm sm:text-base">
                      공개 액세스 허용
                    </span>
                    <input
                      type="checkbox"
                      className="toggle toggle-primary toggle-sm sm:toggle-md"
                      checked={isPublic}
                      onChange={togglePublicAccess}
                    />
                  </label>
                </div>

                {isPublic && shareUrl && (
                  <div className="mt-4">
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        className="input input-bordered input-sm sm:input-md flex-grow text-xs sm:text-sm"
                        value={shareUrl}
                        readOnly
                      />
                      <button
                        className="btn btn-primary btn-sm sm:btn-md whitespace-nowrap"
                        onClick={copyShareUrl}
                      >
                        복사
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-1 sm:gap-2">
            {file?.isWebGLBuild && (
              <button
                className="btn btn-accent btn-sm sm:btn-md"
                onClick={() => router.push(`/play/${hash}`)}
              >
                <FontAwesomeIcon icon={faGamepad} /> 게임 플레이
              </button>
            )}

            <button
              className={`btn btn-primary btn-sm sm:btn-md ${
                downloadLoading ? "loading" : ""
              }`}
              onClick={handleDownload}
              disabled={downloadLoading}
            >
              <FontAwesomeIcon icon={faDownload} /> 다운로드
            </button>

            {(isMediaFile(
              file?.isEncrypted ? file?.originalMimetype : file?.mimetype,
            ) ||
              file?.originalName?.endsWith(".ejtxt")) && (
              <button
                className="btn btn-secondary btn-sm sm:btn-md"
                onClick={handlePreview}
              >
                {file?.originalName?.endsWith(".ejtxt")
                  ? <><FontAwesomeIcon icon={faPenToSquare} /> 편집하기</>
                  : <><FontAwesomeIcon icon={faEye} /> 미리보기</>}
              </button>
            )}
            {isOwner && (
              <button
                className="btn btn-secondary btn-sm sm:btn-md"
                onClick={() => setIsShareModalOpen(true)}
              >
                <FontAwesomeIcon icon={faUpload} /> 공유하기
              </button>
            )}

            {isOwner && (
              <button
                className="btn btn-error btn-sm sm:btn-md"
                onClick={handleDeleteFile}
              >
                <FontAwesomeIcon icon={faTrash} /> 삭제
              </button>
            )}

            <button
              className="btn btn-ghost btn-sm sm:btn-md"
              onClick={() => router.push("/dashboard")}
            >
              <FontAwesomeIcon icon={faHouse} /> 대시보드
            </button>
          </div>
        </div>
      </main>

      <ShareModal
        file={file}
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        onUpdate={handleFileUpdate}
      />

      {/* 암호화된 파일 복호화 모달 */}
      {decryptModal && (
        <div className="modal modal-open">
          <div className="modal-box w-full max-w-sm sm:max-w-md mx-2">
            <h3 className="font-bold text-base sm:text-lg">파일 다운로드</h3>
            <p className="py-4 text-sm sm:text-base">
              이 파일은 암호화되어 있습니다. 복호화 키를 입력해주세요.
            </p>
            <p className="text-xs sm:text-sm text-gray-500 mb-4 break-words">
              파일: {file?.originalName}
            </p>

            <div className="form-control">
              <label className="label">
                <span className="label-text text-sm sm:text-base">
                  복호화 키
                </span>
              </label>
              <input
                type="password"
                className="input input-bordered input-sm sm:input-md"
                placeholder="암호화 시 사용한 비밀번호를 입력하세요"
                value={decryptPassword}
                onChange={(e) => setDecryptPassword(e.target.value)}
              />
            </div>

            <div className="modal-action">
              <button
                className="btn btn-sm sm:btn-md"
                onClick={() => {
                  setDecryptModal(false);
                  setDecryptPassword("");
                }}
              >
                취소
              </button>
              <button
                className={`btn btn-primary btn-sm sm:btn-md ${
                  downloadLoading ? "loading" : ""
                }`}
                onClick={handleEncryptedDownload}
                disabled={downloadLoading}
              >
                다운로드
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 미리보기용 복호화 모달 */}
      {previewDecryptModal && (
        <div className="modal modal-open">
          <div className="modal-box w-full max-w-sm sm:max-w-md mx-2">
            <h3 className="font-bold text-base sm:text-lg">파일 미리보기</h3>
            <p className="py-4 text-sm sm:text-base">
              이 파일은 암호화되어 있습니다. 미리보기를 위해 복호화 키를
              입력해주세요.
            </p>
            <p className="text-xs sm:text-sm text-gray-500 mb-4 break-words">
              파일: {file?.originalName}
            </p>

            <div className="form-control">
              <label className="label">
                <span className="label-text text-sm sm:text-base">
                  복호화 키
                </span>
              </label>
              <input
                type="password"
                className="input input-bordered input-sm sm:input-md"
                placeholder="암호화 시 사용한 비밀번호를 입력하세요"
                value={previewDecryptPassword}
                onChange={(e) => setPreviewDecryptPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handlePreviewDecrypt();
                  }
                }}
                disabled={previewLoading}
              />
            </div>

            <div className="modal-action">
              <button
                className="btn btn-sm sm:btn-md"
                onClick={() => {
                  setPreviewDecryptModal(false);
                  setPreviewDecryptPassword("");
                }}
                disabled={previewLoading}
              >
                취소
              </button>
              <button
                className={`btn btn-primary btn-sm sm:btn-md ${
                  previewLoading ? "loading" : ""
                }`}
                onClick={handlePreviewDecrypt}
                disabled={previewLoading || !previewDecryptPassword.trim()}
              >
                {previewLoading ? "복호화 중..." : "미리보기"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 미리보기 모달 */}
      {previewModal && (
        <div className="modal modal-open">
          <div className="modal-box max-w-xs sm:max-w-2xl md:max-w-4xl w-full mx-2">
            <h3 className="font-bold text-base sm:text-lg break-words">
              {previewModal.file.originalName}
            </h3>
            <div className="py-4">
              {previewModal.file.mimetype?.startsWith("image/") ||
              previewModal.file.originalMimetype?.startsWith("image/") ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewModal.url}
                  alt={previewModal.file.originalName}
                  className="max-w-full h-auto"
                />
              ) : previewModal.file.mimetype?.startsWith("video/") ||
                previewModal.file.originalMimetype?.startsWith("video/") ? (
                <video
                  src={previewModal.url}
                  controls
                  className="max-w-full h-auto"
                />
              ) : previewModal.file.mimetype?.startsWith("audio/") ||
                previewModal.file.originalMimetype?.startsWith("audio/") ? (
                <audio src={previewModal.url} controls className="w-full" />
              ) : previewModal.file.mimetype?.startsWith("application/pdf") ||
                previewModal.file.originalMimetype?.startsWith(
                  "application/pdf",
                ) ? (
                <iframe
                  src={previewModal.url}
                  className="w-full h-[70vh]"
                  title={previewModal.file.originalName}
                >
                  PDF를 표시할 수 없습니다.
                </iframe>
              ) : previewModal.file.originalName?.endsWith(".ejtxt") ? (
                <LiveEditor
                  file={previewModal.file}
                  fileUrl={previewModal.url}
                  encryptionPassword={previewModal.encryptionPassword || null}
                  onClose={() => {
                    if (previewModal.url.startsWith("blob:")) {
                      URL.revokeObjectURL(previewModal.url);
                    }
                    setPreviewModal(null);
                    fetchFileDetails();
                  }}
                />
              ) : previewModal.file.mimetype?.startsWith("text/") ||
                previewModal.file.originalMimetype?.startsWith("text/") ? (
                <iframe
                  src={previewModal.url}
                  className="w-full h-[70vh]"
                  title={previewModal.file.originalName}
                >
                  텍스트를 표시할 수 없습니다.
                </iframe>
              ) : (
                <p>미리보기를 지원하지 않는 파일 형식입니다.</p>
              )}
            </div>
            <div className="modal-action">
              <button
                className="btn"
                onClick={() => {
                  const isEjtxt =
                    previewModal.file.originalName?.endsWith(".ejtxt");
                  if (previewModal.url.startsWith("blob:")) {
                    URL.revokeObjectURL(previewModal.url);
                  }
                  setPreviewModal(null);
                  if (isEjtxt) fetchFileDetails();
                }}
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Alert 모달 */}
      {alertModal.show && (
        <div className="modal modal-open">
          <div className="modal-box w-full max-w-sm sm:max-w-md mx-2">
            <h3 className="font-bold text-base sm:text-lg">알림</h3>
            <p className="py-4 text-sm sm:text-base break-words">
              {alertModal.message}
            </p>
            <div className="modal-action">
              <button
                className="btn btn-primary btn-sm sm:btn-md"
                onClick={() => setAlertModal({ show: false, message: "" })}
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm 모달 */}
      {confirmModal.show && (
        <div className="modal modal-open">
          <div className="modal-box w-full max-w-sm sm:max-w-md mx-2">
            <h3 className="font-bold text-base sm:text-lg">확인</h3>
            <p className="py-4 text-sm sm:text-base break-words">
              {confirmModal.message}
            </p>
            <div className="modal-action">
              <button
                className="btn btn-sm sm:btn-md"
                onClick={() =>
                  setConfirmModal({ show: false, message: "", onConfirm: null })
                }
              >
                취소
              </button>
              <button
                className="btn btn-error btn-sm sm:btn-md"
                onClick={() => {
                  confirmModal.onConfirm?.();
                  setConfirmModal({
                    show: false,
                    message: "",
                    onConfirm: null,
                  });
                }}
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
