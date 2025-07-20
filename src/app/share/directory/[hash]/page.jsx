"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import FileList from "@/app/components/fileList";
import FileUploader from "@/app/components/fileUploader";
import { getSharedDirectoryInfo } from "@/actions/share";
import { downloadSharedFile } from "@/actions/share";
import { decryptForPreview } from "@/lib/crypto/encryption";

export default function SharedDirectoryPage() {
  const params = useParams();
  const { hash } = params;

  const [directoryInfo, setDirectoryInfo] = useState(null);
  const [files, setFiles] = useState([]);
  const [subdirectories, setSubdirectories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [permission, setPermission] = useState("read");
  const [directoryId, setDirectoryId] = useState(null);
  const [previewModal, setPreviewModal] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewPasswordModal, setPreviewPasswordModal] = useState(false);
  const [previewPassword, setPreviewPassword] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [errorModal, setErrorModal] = useState({ show: false, message: "" });
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Error modal helper function
  const showError = (message) => {
    setErrorModal({ show: true, message });
  };

  const handleUploadComplete = () => {
    setRefreshTrigger((prev) => prev + 1);
    // 파일 목록 새로고침
    fetchDirectoryDetails(hash);
  };

  const fetchDirectoryDetails = useCallback(async (shareHash) => {
    try {
      const result = await getSharedDirectoryInfo({ shareHash });

      if (result.error) {
        throw new Error(result.error);
      }

      if (result.success) {
        setDirectoryInfo(result.directory);
        setDirectoryId(result.directory.id);
        setFiles(result.files || []);
        setSubdirectories(result.subdirectories || []);
        setPermission(result.permission);
        setLoading(false);
      }
    } catch (error) {
      console.error("공유 디렉토리 정보 로드 오류:", error);
      setError(error.message || "디렉토리를 불러오는데 실패했습니다.");
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (hash) {
      setLoading(true);
      setError("");
      fetchDirectoryDetails(hash);
    }
  }, [hash, fetchDirectoryDetails]);

  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const isPreviewable = (mimetype) => {
    return (
      mimetype?.startsWith("image/") ||
      mimetype?.startsWith("video/") ||
      mimetype?.startsWith("audio/") ||
      mimetype === "application/pdf"
    );
  };

  const handleFileClick = async (file, event) => {
    event.stopPropagation();

    console.log(
      "파일 클릭:",
      file.name,
      "암호화 여부:",
      file.isEncrypted,
      "현재 MIME 타입:",
      file.mimeType,
      "원본 MIME 타입:",
      file.originalMimetype,
      "미리보기 가능 (현재):",
      isPreviewable(file.mimeType),
      "미리보기 가능 (원본):",
      isPreviewable(file.originalMimetype)
    );

    // 미리보기 가능한 파일인 경우 (암호화된 파일은 originalMimetype, 일반 파일은 mimeType 사용)
    const mimeTypeToCheck = file.isEncrypted
      ? file.originalMimetype || file.mimeType
      : file.mimeType;

    if (isPreviewable(mimeTypeToCheck)) {
      // 암호화된 파일인 경우 비밀번호 입력 모달 표시
      if (file.isEncrypted) {
        console.log("암호화된 파일 - 비밀번호 모달 표시");
        setSelectedFile(file);
        setPreviewPasswordModal(true);
        return;
      }

      console.log("일반 파일 - 바로 미리보기");
      // 일반 파일 미리보기
      await performPreview(file);
    } else {
      console.log("미리보기 불가능한 파일 - 상세 페이지로 이동");
      // 미리보기 불가능한 파일은 공유 파일 페이지로 이동
      window.open(`/share/${file.hash}`, "_blank");
    }
  };

  const performPreview = async (file, password = null) => {
    setPreviewLoading(true);

    try {
      const result = await downloadSharedFile({ hash: file.hash });

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
              originalMimetype: file.originalMimetype || file.mimeType,
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
        type: (file.originalMimetype || file.mimeType).split("/")[0],
        isDecrypted: file.isEncrypted && password,
      });
    } catch (error) {
      console.error("미리보기 오류:", error);
      showError(error.message);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handlePreviewWithPassword = async () => {
    if (!previewPassword.trim()) {
      showError("복호화 비밀번호를 입력해주세요.");
      return;
    }

    setPreviewPasswordModal(false);
    await performPreview(selectedFile, previewPassword);
    setPreviewPassword("");
    setSelectedFile(null);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center">
        <div className="loading loading-spinner loading-lg"></div>
        <p className="mt-4 text-lg">디렉토리 로딩 중...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center">
        <div className="alert alert-error max-w-md">
          <span>{error}</span>
        </div>
        <Link href="/" className="btn btn-primary mt-4">
          홈으로 돌아가기
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base-100">
      {/* Header */}
      <div className="bg-base-200 py-6">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold">{directoryInfo?.name}</h1>
                <div className="badge badge-accent gap-2">
                  <span>👤</span>
                  <span className="text-sm">
                    {directoryInfo?.owner?.name || directoryInfo?.owner?.email}
                    님이 공유
                  </span>
                </div>
              </div>
              {directoryInfo?.description && (
                <p className="text-sm text-gray-700 mt-2">
                  {directoryInfo.description}
                </p>
              )}
            </div>
            <div className="text-right">
              <div className="badge badge-primary">
                {permission === "read" ? "읽기 전용" : "읽기/쓰기"}
              </div>
              <p className="text-sm text-gray-600 mt-1">
                생성일: {formatDate(directoryInfo?.createdAt)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8">
        {/* Subdirectories */}
        {subdirectories.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4">📁 하위 폴더</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {subdirectories.map((directory) => (
                <div
                  key={directory.id}
                  className="card bg-base-200 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="card-body p-4">
                    <div className="flex items-center">
                      <span className="text-2xl mr-3">📁</span>
                      <div className="flex-1">
                        <h3 className="font-medium">{directory.name}</h3>
                        <p className="text-sm text-gray-600">
                          {formatDate(directory.createdAt)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Files */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">📄 파일 목록</h2>
          </div>
          {permission === "write" && directoryId && (
            <div className="w-auto">
              <FileUploader
                directoryId={directoryId}
                shareHash={hash}
                onUploadComplete={handleUploadComplete}
                buttonText="파일 업로드"
                className="btn btn-primary btn-sm"
              />
            </div>
          )}
          {files.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📂</div>
              <p className="text-gray-600">이 폴더에는 파일이 없습니다.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table table-zebra w-full">
                <thead>
                  <tr>
                    <th>파일명</th>
                    <th>크기</th>
                    <th>업로드일</th>
                  </tr>
                </thead>
                <tbody>
                  {files.map((file) => (
                    <tr
                      key={file.id}
                      className="hover:bg-base-300 cursor-pointer transition-colors"
                      onClick={(e) => handleFileClick(file, e)}
                    >
                      <td>
                        <div className="flex items-center">
                          <span className="mr-2">
                            {(
                              file.originalMimetype || file.mimeType
                            )?.startsWith("image/")
                              ? "🖼️"
                              : (
                                  file.originalMimetype || file.mimeType
                                )?.startsWith("video/")
                              ? "🎥"
                              : (
                                  file.originalMimetype || file.mimeType
                                )?.startsWith("audio/")
                              ? "🎵"
                              : (
                                  file.originalMimetype || file.mimeType
                                )?.includes("pdf")
                              ? "📄"
                              : (
                                  file.originalMimetype || file.mimeType
                                )?.includes("document")
                              ? "📝"
                              : (
                                  file.originalMimetype || file.mimeType
                                )?.includes("spreadsheet")
                              ? "📊"
                              : "📄"}
                          </span>
                          <span className="font-medium">{file.name}</span>
                          {file.isEncrypted && (
                            <span className="ml-2">
                              <span className="badge badge-warning badge-sm">
                                🔒
                              </span>
                            </span>
                          )}
                        </div>
                      </td>
                      <td>{formatFileSize(file.size)}</td>
                      <td>{formatDate(file.uploadedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="bg-base-200 py-4 mt-12">
        <div className="container mx-auto px-4 text-center">
          <p className="text-sm text-gray-600">
            Powered by{" "}
            <Link href="/" className="link link-primary">
              Shareify
            </Link>
          </p>
        </div>
      </div>

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
                  setSelectedFile(null);
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
              <h2 className="text-xl font-bold">{previewModal.file.name}</h2>
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
                  alt={previewModal.file.name}
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
            </div>

            <div className="mt-4 text-center">
              <button
                className="btn btn-primary"
                onClick={() =>
                  window.open(`/share/${previewModal.file.hash}`, "_blank")
                }
              >
                파일 페이지로 이동
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 로딩 모달 */}
      {previewLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-base-100 rounded-lg p-6">
            <div className="flex flex-col items-center">
              <div className="loading loading-spinner loading-lg mb-4"></div>
              <p>미리보기 준비 중...</p>
            </div>
          </div>
        </div>
      )}

      {/* 에러 모달 */}
      {errorModal.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-base-100 rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4 text-error">❌ 오류</h2>
            <p className="text-sm text-gray-700 mb-6">{errorModal.message}</p>
            <div className="flex justify-end">
              <button
                className="btn btn-primary"
                onClick={() => setErrorModal({ show: false, message: "" })}
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
