"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import Navbar from "@/app/components/navbar";
import ShareModal from "@/app/components/shareModal";
import { useAuth } from "@/context/AuthContext";
import {
  getFileDetails,
  getFileDownloadUrl,
  deleteFile,
} from "@/actions/files";
import { toggleFilePublic } from "@/actions/share";
import {
  downloadAndDecrypt,
  isMediaFile,
  decryptForPreview,
} from "@/lib/crypto/encryption";

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
        metadata
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
        const result = await getFileDownloadUrl({ fileId: file.id });
        if (result.error) {
          showAlert(result.error);
          return;
        }
        setPreviewModal({ file, url: result.downloadUrl });
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
      const result = await getFileDownloadUrl({ fileId: file.id });
      if (result.error) {
        showAlert(result.error);
        return;
      }

      // 암호화된 파일 다운로드
      const response = await fetch(result.downloadUrl);
      const encryptedArrayBuffer = await response.arrayBuffer();

      // 복호화
      const decryptResult = await decryptForPreview(
        encryptedArrayBuffer,
        previewDecryptPassword
      );

      if (decryptResult.error) {
        showAlert(decryptResult.error);
        return;
      }

      const previewUrl = URL.createObjectURL(decryptResult.blob);
      setPreviewModal({ file, url: previewUrl });

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
            router.push("/dashboard");
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
        <Navbar />
        <main className="flex min-h-screen flex-col items-center justify-center pt-20">
          <div className="loading loading-spinner loading-lg"></div>
        </main>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Navbar />
        <main className="flex min-h-screen flex-col p-8 pt-20">
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
      <Navbar />
      <main className="flex min-h-screen flex-col p-4 md:p-8 pt-20">
        <div className="breadcrumbs mb-4">
          <ul>
            <li>
              <button onClick={() => router.push("/dashboard")}>내 파일</button>
            </li>
            <li>{file?.originalName}</li>
          </ul>
        </div>

        <div className="card bg-base-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <h1 className="text-3xl font-bold">{file?.originalName}</h1>
            {file?.isEncrypted && (
              <div className="badge badge-primary">🔒 암호화됨</div>
            )}
            {file?.isPublic && <div className="badge badge-success">공개</div>}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <h2 className="text-lg font-semibold mb-2">파일 정보</h2>
              <ul className="space-y-2">
                <li>
                  <strong>크기:</strong>{" "}
                  {formatBytes(
                    file?.isEncrypted ? file?.originalSize : file?.size
                  )}
                </li>
                <li>
                  <strong>유형:</strong>{" "}
                  {file?.isEncrypted ? file?.originalMimetype : file?.mimetype}
                </li>
                <li>
                  <strong>업로드 일시:</strong> {formatDate(file?.createdAt)}
                </li>
                {file?.isEncrypted && (
                  <li>
                    <strong>암호화:</strong>{" "}
                    <span className="text-primary">AES-256-GCM</span>
                  </li>
                )}
              </ul>
            </div>

            {isOwner && (
              <div>
                <h2 className="text-lg font-semibold mb-2">액세스 설정</h2>
                <div className="form-control">
                  <label className="label cursor-pointer">
                    <span className="label-text">공개 액세스 허용</span>
                    <input
                      type="checkbox"
                      className="toggle toggle-primary"
                      checked={isPublic}
                      onChange={togglePublicAccess}
                    />
                  </label>
                </div>

                {isPublic && shareUrl && (
                  <div className="mt-4">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        className="input input-bordered flex-grow"
                        value={shareUrl}
                        readOnly
                      />
                      <button
                        className="btn btn-primary"
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

          <div className="flex flex-wrap gap-2">
            <button
              className={`btn btn-primary ${downloadLoading ? "loading" : ""}`}
              onClick={handleDownload}
              disabled={downloadLoading}
            >
              다운로드
            </button>

            {isMediaFile(
              file?.isEncrypted ? file?.originalMimetype : file?.mimetype
            ) && (
              <button className="btn btn-secondary" onClick={handlePreview}>
                미리보기
              </button>
            )}

            <button
              className="btn btn-secondary"
              onClick={() => setIsShareModalOpen(true)}
            >
              공유하기
            </button>

            {isOwner && (
              <button className="btn btn-error" onClick={handleDeleteFile}>
                삭제
              </button>
            )}

            <button
              className="btn btn-ghost"
              onClick={() => router.push("/dashboard")}
            >
              대시보드로 돌아가기
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
          <div className="modal-box">
            <h3 className="font-bold text-lg">파일 다운로드</h3>
            <p className="py-4">
              이 파일은 암호화되어 있습니다. 복호화 키를 입력해주세요.
            </p>
            <p className="text-sm text-gray-500 mb-4">
              파일: {file?.originalName}
            </p>

            <div className="form-control">
              <label className="label">
                <span className="label-text">복호화 키</span>
              </label>
              <input
                type="password"
                className="input input-bordered"
                placeholder="암호화 시 사용한 비밀번호를 입력하세요"
                value={decryptPassword}
                onChange={(e) => setDecryptPassword(e.target.value)}
              />
            </div>

            <div className="modal-action">
              <button
                className="btn"
                onClick={() => {
                  setDecryptModal(false);
                  setDecryptPassword("");
                }}
              >
                취소
              </button>
              <button
                className={`btn btn-primary ${
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
          <div className="modal-box">
            <h3 className="font-bold text-lg">파일 미리보기</h3>
            <p className="py-4">
              이 파일은 암호화되어 있습니다. 미리보기를 위해 복호화 키를
              입력해주세요.
            </p>
            <p className="text-sm text-gray-500 mb-4">
              파일: {file?.originalName}
            </p>

            <div className="form-control">
              <label className="label">
                <span className="label-text">복호화 키</span>
              </label>
              <input
                type="password"
                className="input input-bordered"
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
                className="btn"
                onClick={() => {
                  setPreviewDecryptModal(false);
                  setPreviewDecryptPassword("");
                }}
                disabled={previewLoading}
              >
                취소
              </button>
              <button
                className={`btn btn-primary ${previewLoading ? "loading" : ""}`}
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
          <div className="modal-box max-w-4xl">
            <h3 className="font-bold text-lg">
              {previewModal.file.originalName}
            </h3>
            <div className="py-4">
              {previewModal.file.mimetype?.startsWith("image/") ||
              previewModal.file.originalMimetype?.startsWith("image/") ? (
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
              ) : (
                <p>미리보기를 지원하지 않는 파일 형식입니다.</p>
              )}
            </div>
            <div className="modal-action">
              <button
                className="btn"
                onClick={() => {
                  if (previewModal.url.startsWith("blob:")) {
                    URL.revokeObjectURL(previewModal.url);
                  }
                  setPreviewModal(null);
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
          <div className="modal-box">
            <h3 className="font-bold text-lg">알림</h3>
            <p className="py-4">{alertModal.message}</p>
            <div className="modal-action">
              <button
                className="btn btn-primary"
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
          <div className="modal-box">
            <h3 className="font-bold text-lg">확인</h3>
            <p className="py-4">{confirmModal.message}</p>
            <div className="modal-action">
              <button
                className="btn"
                onClick={() =>
                  setConfirmModal({ show: false, message: "", onConfirm: null })
                }
              >
                취소
              </button>
              <button
                className="btn btn-error"
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
