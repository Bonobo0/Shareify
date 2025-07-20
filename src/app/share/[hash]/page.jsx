"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Navbar from "@/app/components/navbar";
import { useAuth } from "@/context/AuthContext";
import { getSharedFileInfo, downloadSharedFile } from "@/actions/share";
import { downloadAndDecrypt, decryptForPreview } from "@/lib/crypto/encryption";

export default function SharePage() {
  const params = useParams();
  const { hash } = params;
  const { user } = useAuth();

  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [decryptionPassword, setDecryptionPassword] = useState("");
  const [decryptionLoading, setDecryptionLoading] = useState(false);
  const [alertModal, setAlertModal] = useState({ show: false, message: "" });
  const [previewModal, setPreviewModal] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewPasswordModal, setPreviewPasswordModal] = useState(false);
  const [previewPassword, setPreviewPassword] = useState("");

  // Modal helper functions
  const showAlert = (message) => {
    setAlertModal({ show: true, message });
  };

  const isPreviewable = (mimetype) => {
    return (
      mimetype?.startsWith("image/") ||
      mimetype?.startsWith("video/") ||
      mimetype?.startsWith("audio/") ||
      mimetype === "application/pdf"
    );
  };

  const handlePreview = async () => {
    if (!file || !isPreviewable(file.mimetype)) {
      showAlert("이 파일은 미리보기를 지원하지 않습니다.");
      return;
    }

    // 암호화된 파일인 경우 비밀번호 입력 모달 표시
    if (file.isEncrypted) {
      setPreviewPasswordModal(true);
      return;
    }

    // 일반 파일 미리보기
    await performPreview();
  };

  const performPreview = async (password = null) => {
    setPreviewLoading(true);

    try {
      const result = await downloadSharedFile({ hash });

      if (!result.success) {
        throw new Error(
          result.error || "미리보기 URL을 생성하는 중 오류가 발생했습니다."
        );
      }

      let previewUrl = result.downloadUrl;

      // 암호화된 파일인 경우 복호화
      if (file.isEncrypted && password) {
        console.log("암호화된 파일 복호화 시작...");
        try {
          const decryptedBlob = await decryptForPreview(
            result.downloadUrl,
            password,
            {
              originalName: file.name,
              originalMimetype:
                result.originalMimetype ||
                file.originalMimetype ||
                file.mimetype,
            }
          );
          previewUrl = URL.createObjectURL(decryptedBlob);
          console.log("암호화된 파일 복호화 완료");
        } catch (decryptError) {
          console.error("복호화 실패:", decryptError);
          throw new Error("복호화에 실패했습니다. 비밀번호를 확인해주세요.");
        }
      }

      setPreviewModal({
        file: file,
        url: previewUrl,
        type: file.mimetype.split("/")[0],
        isDecrypted: file.isEncrypted && password,
      });
    } catch (error) {
      showAlert(error.message);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handlePreviewWithPassword = async () => {
    if (!previewPassword.trim()) {
      showAlert("복호화 비밀번호를 입력해주세요.");
      return;
    }

    setPreviewPasswordModal(false);
    await performPreview(previewPassword);
    setPreviewPassword("");
  };

  const fetchSharedFile = useCallback(async () => {
    try {
      const result = await getSharedFileInfo({ hash });

      if (!result.success) {
        throw new Error(
          result.error || "파일 정보를 불러오는 중 오류가 발생했습니다."
        );
      }

      setFile(result.file);
    } catch (error) {
      setError(error.message || "파일을 찾을 수 없습니다.");
    } finally {
      setLoading(false);
    }
  }, [hash]);

  useEffect(() => {
    if (hash) {
      fetchSharedFile();
    }
  }, [hash, fetchSharedFile]);

  const handleDownload = async () => {
    try {
      // 암호화된 파일인 경우 비밀번호 모달 표시
      if (file?.isEncrypted) {
        setShowPasswordModal(true);
        return;
      }

      // 일반 파일 다운로드
      const result = await downloadSharedFile({ hash });

      if (!result.success) {
        throw new Error(
          result.error || "다운로드 URL을 생성하는 중 오류가 발생했습니다."
        );
      }

      window.open(result.downloadUrl, "_blank");
    } catch (error) {
      showAlert(error.message);
    }
  };

  const handleEncryptedDownload = async () => {
    if (!decryptionPassword.trim()) {
      showAlert("복호화 비밀번호를 입력해주세요.");
      return;
    }

    setDecryptionLoading(true);

    try {
      // 암호화된 파일 다운로드 URL 생성
      const result = await downloadSharedFile({ hash });

      if (!result.success) {
        throw new Error(
          result.error || "다운로드 URL을 생성하는 중 오류가 발생했습니다."
        );
      }

      // 암호화된 파일 복호화 및 다운로드
      await downloadAndDecrypt(result.downloadUrl, decryptionPassword, {
        originalName: result.filename || file.originalName,
        originalMimetype:
          result.originalMimetype || file.originalMimetype || file.mimetype,
        originalSize: result.originalSize || file.originalSize || file.size,
      });

      // 성공 후 모달 닫기
      setShowPasswordModal(false);
      setDecryptionPassword("");
    } catch (error) {
      showAlert(error.message || "파일 복호화 중 오류가 발생했습니다.");
    } finally {
      setDecryptionLoading(false);
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

  if (loading) {
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
        <main className="flex min-h-screen flex-col items-center p-8 pt-20">
          <div className="alert alert-error max-w-md">{error}</div>
          <p className="mt-4">
            이 파일은 존재하지 않거나, 접근 권한이 없거나, 공개 상태가
            변경되었을 수 있습니다.
          </p>

          {!user && (
            <div className="mt-6">
              <p>계정이 있으신가요?</p>
              <Link href="/user/signin" className="btn btn-primary mt-2">
                로그인
              </Link>
            </div>
          )}
        </main>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <main className="flex min-h-screen flex-col items-center p-4 md:p-8 pt-20">
        <div className="card bg-base-200 p-6 max-w-xl w-full">
          <h1 className="text-3xl font-bold mb-6 text-center">공유된 파일</h1>

          <div className="text-center mb-8">
            <div className="text-5xl mb-4">
              {file?.mimetype?.includes("image")
                ? "🖼️"
                : file?.mimetype?.includes("pdf")
                ? "📄"
                : file?.mimetype?.includes("video")
                ? "🎬"
                : file?.mimetype?.includes("audio")
                ? "🎵"
                : "📁"}
            </div>

            <h2 className="text-xl font-semibold">{file?.originalName}</h2>
            <p className="text-gray-500 mt-2">
              {formatBytes(file?.originalSize || file?.size)}
            </p>

            {file?.isEncrypted && (
              <div className="mt-4">
                <span className="badge badge-warning">🔒 암호화된 파일</span>
              </div>
            )}
          </div>

          <div className="flex justify-center gap-4">
            {isPreviewable(file?.mimetype) && (
              <button
                className={`btn btn-secondary btn-lg ${
                  previewLoading ? "loading" : ""
                }`}
                onClick={handlePreview}
                disabled={previewLoading}
              >
                {previewLoading
                  ? "로딩 중..."
                  : file?.isEncrypted
                  ? "🔒 복호화 후 미리보기"
                  : "미리보기"}
              </button>
            )}
            <button className="btn btn-primary btn-lg" onClick={handleDownload}>
              {file?.isEncrypted ? "🔒 복호화 후 다운로드" : "다운로드"}
            </button>
          </div>

          {!user && (
            <div className="text-center mt-8 pt-4 border-t">
              <p>더 많은 파일을 공유하고 관리하세요</p>
              <div className="flex justify-center gap-2 mt-2">
                <Link href="/user/signin" className="btn">
                  로그인
                </Link>
                <Link href="/user/signup" className="btn btn-outline">
                  회원가입
                </Link>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* 암호화 파일 비밀번호 입력 모달 */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-base-100 rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">🔒 파일 복호화</h2>

            <p className="text-sm text-gray-600 mb-4">
              이 파일은 암호화되어 있습니다. 복호화를 위해 비밀번호를
              입력해주세요.
            </p>

            <div className="form-control mb-4">
              <label className="label">
                <span className="label-text">복호화 비밀번호</span>
              </label>
              <input
                type="password"
                placeholder="비밀번호를 입력하세요"
                className="input input-bordered"
                value={decryptionPassword}
                onChange={(e) => setDecryptionPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleEncryptedDownload();
                  }
                }}
                disabled={decryptionLoading}
              />
            </div>

            <div className="flex gap-2 justify-end">
              <button
                className="btn btn-ghost"
                onClick={() => {
                  setShowPasswordModal(false);
                  setDecryptionPassword("");
                }}
                disabled={decryptionLoading}
              >
                취소
              </button>
              <button
                className={`btn btn-primary ${
                  decryptionLoading ? "loading" : ""
                }`}
                onClick={handleEncryptedDownload}
                disabled={decryptionLoading || !decryptionPassword.trim()}
              >
                {decryptionLoading ? "복호화 중..." : "복호화 후 다운로드"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 미리보기용 암호화 파일 비밀번호 입력 모달 */}
      {previewPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-base-100 rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">🔒 파일 미리보기</h2>

            <p className="text-sm text-gray-600 mb-4">
              이 파일은 암호화되어 있습니다. 미리보기를 위해 복호화 비밀번호를
              입력해주세요.
            </p>

            <div className="form-control mb-4">
              <label className="label">
                <span className="label-text">복호화 비밀번호</span>
              </label>
              <input
                type="password"
                placeholder="비밀번호를 입력하세요"
                className="input input-bordered"
                value={previewPassword}
                onChange={(e) => setPreviewPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handlePreviewWithPassword();
                  }
                }}
                disabled={previewLoading}
              />
            </div>

            <div className="flex gap-2 justify-end">
              <button
                className="btn btn-ghost"
                onClick={() => {
                  setPreviewPasswordModal(false);
                  setPreviewPassword("");
                }}
                disabled={previewLoading}
              >
                취소
              </button>
              <button
                className={`btn btn-primary ${previewLoading ? "loading" : ""}`}
                onClick={handlePreviewWithPassword}
                disabled={previewLoading || !previewPassword.trim()}
              >
                {previewLoading ? "복호화 중..." : "미리보기"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 미리보기 모달 */}
      {previewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 p-4">
          <div className="bg-base-100 rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">
                {previewModal.file.originalName}
              </h2>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  // 복호화된 URL인 경우 메모리 해제
                  if (
                    previewModal.isDecrypted &&
                    previewModal.url.startsWith("blob:")
                  ) {
                    URL.revokeObjectURL(previewModal.url);
                  }
                  setPreviewModal(null);
                }}
              >
                ✕
              </button>
            </div>

            <div className="flex justify-center">
              {previewModal.type === "image" && (
                <img
                  src={previewModal.url}
                  alt={previewModal.file.originalName}
                  className="max-w-full max-h-[70vh] object-contain"
                />
              )}
              {previewModal.type === "video" && (
                <video
                  src={previewModal.url}
                  controls
                  className="max-w-full max-h-[70vh]"
                >
                  브라우저가 비디오를 지원하지 않습니다.
                </video>
              )}
              {previewModal.type === "audio" && (
                <div className="w-full">
                  <audio src={previewModal.url} controls className="w-full">
                    브라우저가 오디오를 지원하지 않습니다.
                  </audio>
                </div>
              )}
              {previewModal.file.mimetype === "application/pdf" && (
                <iframe
                  src={previewModal.url}
                  className="w-full h-[70vh]"
                  title={previewModal.file.originalName}
                >
                  PDF를 표시할 수 없습니다.
                </iframe>
              )}
            </div>

            <div className="mt-4 text-center">
              <button
                className="btn btn-primary"
                onClick={() => {
                  setPreviewModal(null);
                  handleDownload();
                }}
              >
                다운로드
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Alert Modal */}
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
    </>
  );
}
