"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import CreateSharedDirectory from "@/app/components/createSharedDirectory";
import FileUploader from "@/app/components/fileUploader";
import SelectedDownloadModal from "@/app/components/selectedDownloadModal";
import BulkDownloadModal from "@/app/components/bulkDownloadModal";
import { getSharedDirectoryInfo } from "@/actions/share";
import {
  downloadSharedFile,
  downloadSharedDirectoryFile,
} from "@/actions/share";
import { decryptForPreview, downloadAndDecrypt } from "@/lib/crypto/encryption";
import DeleteSharedDirectory from "@/app/components/deleteDirectory";
import PreviewModal from "@/app/components/previewModal";
import SharedWebGLPlayer from "@/app/components/sharedWebGLPlayer";

export default function SharedDirectoryPage() {
  const params = useParams();
  const router = useRouter();
  const { hash } = params;

  const [directoryInfo, setDirectoryInfo] = useState(null);
  const [files, setFiles] = useState([]);
  const [subdirectories, setSubdirectories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [permission, setPermission] = useState("read");
  const [expiresAt, setExpiresAt] = useState(null);
  const [directoryId, setDirectoryId] = useState(null);
  const [currentPath, setCurrentPath] = useState(""); // 현재 경로 추적
  const [breadcrumbs, setBreadcrumbs] = useState([]); // 브레드크럼 추적
  const [previewModal, setPreviewModal] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewPasswordModal, setPreviewPasswordModal] = useState(false);
  const [previewPassword, setPreviewPassword] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [errorModal, setErrorModal] = useState({ show: false, message: "" });
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // WebGL 관련 상태
  const [showWebGLModal, setShowWebGLModal] = useState(false);
  const [webGLFile, setWebGLFile] = useState(null);
  const [showWebGLPlayer, setShowWebGLPlayer] = useState(false);
  const [webGLBlob, setWebGLBlob] = useState(null);
  const [webGLPasswordModal, setWebGLPasswordModal] = useState(false);
  const [webGLPassword, setWebGLPassword] = useState("");
  const [webGLLoading, setWebGLLoading] = useState(false);

  // 파일 선택 관련 상태
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadingFiles, setDownloadingFiles] = useState({});

  // 다운로드 모달 상태
  const [showSelectedDownloadModal, setShowSelectedDownloadModal] =
    useState(false);
  const [showBulkDownloadModal, setShowBulkDownloadModal] = useState(false);

  // 파일 선택 토글 함수
  const toggleFileSelection = (fileId) => {
    const isSelected = selectedFiles.includes(fileId);
    if (isSelected) {
      setSelectedFiles((prev) => prev.filter((id) => id !== fileId));
    } else {
      setSelectedFiles((prev) => [...prev, fileId]);
    }
  };

  // Error modal helper function
  const showError = (message) => {
    setErrorModal({ show: true, message });
  };

  const handleUploadComplete = () => {
    setRefreshTrigger((prev) => prev + 1);
    // 파일 목록 새로고침
    fetchDirectoryDetails(hash, currentPath);
  };

  // 개별 파일 다운로드 (미리보기 불가능한 경우)
  const downloadSingleFile = async (file) => {
    try {
      setDownloadingFiles((prev) => ({ ...prev, [file.id]: true }));

      const result = await downloadSharedDirectoryFile({
        shareHash: hash,
        fileId: file.id,
      });

      if (!result.success) {
        throw new Error(result.error || "다운로드 실패");
      }

      // 다운로드 URL로 파일 다운로드
      const response = await fetch(result.downloadUrl);
      if (!response.ok) {
        throw new Error(`다운로드 실패: ${response.status}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.style.display = "none";
      a.href = url;
      a.download = result.filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("파일 다운로드 실패:", error);
      showError("파일 다운로드에 실패했습니다: " + error.message);
    } finally {
      setDownloadingFiles((prev) => ({ ...prev, [file.id]: false }));
    }
  };

  // 하위 디렉토리 클릭 핸들러
  const handleDirectoryClick = (directoryName) => {
    const newPath = currentPath
      ? `${currentPath}/${directoryName}`
      : directoryName;
    setLoading(true);
    fetchDirectoryDetails(hash, newPath);
  };

  // 브레드크럼 클릭 핸들러
  const handleBreadcrumbClick = (path) => {
    setLoading(true);
    fetchDirectoryDetails(hash, path);
  };

  const fetchDirectoryDetails = useCallback(async (shareHash, subPath = "") => {
    try {
      const result = await getSharedDirectoryInfo({
        shareHash,
        subPath: subPath || undefined,
      });

      if (result.error) {
        throw new Error(result.error);
      }

      if (result.success) {
        setDirectoryInfo(result.directory);
        setExpiresAt(result.expiresAt || null);
        setDirectoryId(result.directory.id);
        setFiles(result.files || []);
        setSubdirectories(result.subdirectories || []);
        setPermission(result.permission);
        setCurrentPath(subPath);

        // 서버에서 받은 브레드크럼 정보 사용
        if (result.breadcrumbs) {
          setBreadcrumbs(result.breadcrumbs);
        } else {
          // 폴백: 기본 브레드크럼 설정
          setBreadcrumbs([
            {
              name: result.directory.name,
              path: "",
              description: result.directory.description,
            },
          ]);
        }

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

  const handleFileClick = async (file, event) => {
    // WebGL 빌드인 경우 특별 처리
    if (file.isWebGLBuild) {
      setWebGLFile(file);
      setShowWebGLModal(true);
      return;
    }

    // 미리보기 가능한 파일인지 확인
    const mimeType = file.originalMimetype || file.mimeType || "";
    const isPreviewableFile =
      (mimeType.startsWith("image/") ||
        mimeType.startsWith("video/") ||
        mimeType.startsWith("audio/") ||
        mimeType === "application/pdf" ||
        mimeType.startsWith("text/")) &&
      file.size < 100 * 1024 * 1024; // 100MB 이하

    // 암호화된 파일이고 미리보기 가능한 경우 비밀번호 모달 표시
    if (file.isEncrypted && isPreviewableFile) {
      setSelectedFile(file);
      setPreviewPasswordModal(true);
      return;
    }

    // 암호화된 파일이지만 미리보기 불가능한 경우 파일 상세페이지로 이동
    if (file.isEncrypted && !isPreviewableFile) {
      router.push(`/share/${file.hash}`);
      return;
    }

    // 암호화되지 않은 파일 처리
    if (isPreviewableFile) {
      // 미리보기 모달 열기
      try {
        setPreviewLoading(true);
        const result = await downloadSharedDirectoryFile({
          shareHash: hash,
          fileId: file.id,
        });
        if (result.success) {
          const response = await fetch(result.downloadUrl);

          if (response.ok) {
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);

            setPreviewModal({
              isOpen: true,
              file: file,
              url: url,
              mimeType: mimeType,
              type: mimeType.split("/")[0], // image, video, audio 등
            });
            setPreviewLoading(false);
          } else {
            // 미리보기 실패시 파일 상세페이지로 이동
            router.push(`/share/${file.hash}`);
          }
        } else {
          // 미리보기 실패시 파일 상세페이지로 이동
          router.push(`/share/${file.hash}`);
        }
      } catch (error) {
        console.error("미리보기 실패:", error);
        router.push(`/share/${file.hash}`);
      }
    } else {
      // 미리보기 불가능한 파일은 파일 상세페이지로 이동
      router.push(`/share/${file.hash}`);
    }
  };

  const performPreview = async (file, password = null) => {
    setPreviewLoading(true);

    try {
      const result = await downloadSharedDirectoryFile({
        shareHash: hash,
        fileId: file.id,
      });

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
          // URL에서 ArrayBuffer 가져오기
          const response = await fetch(result.downloadUrl);
          if (!response.ok) {
            throw new Error("파일 다운로드 실패");
          }
          const encryptedArrayBuffer = await response.arrayBuffer();

          const decryptResult = await decryptForPreview(
            encryptedArrayBuffer,
            password,
            {
              originalName: file.name,
              originalMimetype: file.originalMimetype || file.mimeType,
            }
          );

          if (decryptResult.success) {
            previewUrl = URL.createObjectURL(decryptResult.blob);
            console.log("암호화된 파일 복호화 완료");
          } else {
            throw new Error(decryptResult.error || "복호화 실패");
          }
        } catch (decryptError) {
          console.error("복호화 실패:", decryptError);
          // 더 구체적인 에러 메시지 제공
          if (
            decryptError.message?.includes("incorrect password") ||
            decryptError.message?.includes("wrong password") ||
            decryptError.message?.includes("decryption failed") ||
            decryptError.message?.includes("Decryption failed")
          ) {
            throw new Error("복호화에 실패했습니다. 비밀번호를 확인해주세요.");
          } else {
            throw new Error(`복호화 오류: ${decryptError.message}`);
          }
        }
      } else if (!file.isEncrypted) {
        // 암호화되지 않은 파일의 경우 직접 fetch
        const response = await fetch(result.downloadUrl);
        if (!response.ok) {
          throw new Error("파일 다운로드 실패");
        }
        const blob = await response.blob();
        previewUrl = URL.createObjectURL(blob);
      }

      const mimeType = file.originalMimetype || file.mimeType;
      setPreviewModal({
        isOpen: true,
        file: file,
        url: previewUrl,
        mimeType: mimeType,
        type: mimeType.split("/")[0],
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

  // WebGL 게임 다운로드 및 플레이 함수
  const handleWebGLDownload = async () => {
    if (!webGLFile) return;

    try {
      const result = await downloadSharedDirectoryFile({
        shareHash: hash,
        fileId: webGLFile.id,
      });

      if (!result.success) {
        throw new Error(result.error || "다운로드 실패");
      }

      // 다운로드 URL로 파일 다운로드
      const response = await fetch(result.downloadUrl);
      if (!response.ok) {
        throw new Error(`다운로드 실패: ${response.status}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.style.display = "none";
      a.href = url;
      a.download = result.filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setShowWebGLModal(false);
      setWebGLFile(null);
    } catch (error) {
      console.error("파일 다운로드 실패:", error);
      showError("파일 다운로드에 실패했습니다: " + error.message);
    }
  };

  const handleWebGLPlay = async () => {
    if (!webGLFile) return;

    // 암호화된 파일인 경우 비밀번호 입력 모달 표시
    if (webGLFile.isEncrypted) {
      setShowWebGLModal(false);
      setWebGLPasswordModal(true);
      return;
    }

    // 일반 파일 플레이
    await performWebGLPlay();
  };

  const performWebGLPlay = async (password = null) => {
    setWebGLLoading(true);

    try {
      const result = await downloadSharedDirectoryFile({
        shareHash: hash,
        fileId: webGLFile.id,
      });

      if (!result.success) {
        throw new Error(
          result.error || "다운로드 URL을 생성하는 중 오류가 발생했습니다."
        );
      }

      let fileBlob;

      // 암호화된 파일인 경우 복호화
      if (webGLFile.isEncrypted && password) {
        console.log("암호화된 WebGL 빌드 복호화 시작...");
        try {
          const response = await fetch(result.downloadUrl);
          if (!response.ok) {
            throw new Error("파일 다운로드 실패");
          }

          // 복호화
          const decryptedData = await downloadAndDecrypt(
            result.downloadUrl,
            password,
            {
              originalName: webGLFile.name,
              originalMimetype:
                webGLFile.originalMimetype || webGLFile.mimeType,
              originalSize: webGLFile.originalSize || webGLFile.size,
            }
          );

          fileBlob = new Blob([decryptedData], { type: "application/zip" });
          console.log("암호화된 WebGL 빌드 복호화 완료");
        } catch (decryptError) {
          console.error("복호화 실패:", decryptError);
          throw new Error("복호화에 실패했습니다. 비밀번호를 확인해주세요.");
        }
      } else {
        // 일반 파일 다운로드
        const response = await fetch(result.downloadUrl);
        if (!response.ok) {
          throw new Error("파일 다운로드 실패");
        }
        fileBlob = await response.blob();
      }

      setWebGLBlob(fileBlob);
      setShowWebGLPlayer(true);
      setShowWebGLModal(false);
    } catch (error) {
      console.error("게임 로드 오류:", error);
      showError(error.message);
    } finally {
      setWebGLLoading(false);
    }
  };

  const handleWebGLPlayWithPassword = async () => {
    if (!webGLPassword.trim()) {
      showError("복호화 비밀번호를 입력해주세요.");
      return;
    }

    setWebGLPasswordModal(false);
    await performWebGLPlay(webGLPassword);
    setWebGLPassword("");
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
        <div className="container mx-auto px-4 sm:px-6 md:px-8">
          {/* 브레드크럼 네비게이션 */}
          {breadcrumbs.length > 0 && (
            <div className="breadcrumbs text-sm mb-4">
              <ul>
                {breadcrumbs.map((crumb, index) => (
                  <li key={index}>
                    {index === breadcrumbs.length - 1 ? (
                      <span className="  font-medium">{crumb.name}</span>
                    ) : (
                      <button
                        className="text-blue-600 hover:text-blue-800"
                        onClick={() => handleBreadcrumbClick(crumb.path)}
                      >
                        {crumb.name}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="mb-2">
                <h1 className="text-2xl sm:text-3xl font-bold break-words">
                  {breadcrumbs.length > 1
                    ? breadcrumbs[breadcrumbs.length - 1].name
                    : directoryInfo?.name}
                </h1>
              </div>
              {/* 현재 디렉토리의 설명 표시 */}
              {(breadcrumbs.length > 1
                ? breadcrumbs[breadcrumbs.length - 1].description
                : directoryInfo?.description) && (
                <p className="text-sm text-gray-400 mt-2 break-words">
                  {breadcrumbs.length > 1
                    ? breadcrumbs[breadcrumbs.length - 1].description
                    : directoryInfo?.description}
                </p>
              )}
            </div>
            <div className="flex flex-col lg:text-right gap-2">
              <div className="flex flex-wrap items-center gap-2 justify-start lg:justify-end">
                <div className="btn btn-accent btn-xs gap-2 flex-shrink-0">
                  <span>👤</span>
                  <span className="text-sm truncate max-w-32">
                    {directoryInfo?.owner?.name || directoryInfo?.owner?.email}
                    님이 공유
                  </span>
                </div>
                <div className="badge badge-primary flex-shrink-0">
                  {permission === "read" ? "읽기 전용" : "읽기/쓰기"}
                </div>
              </div>
              <p className="text-sm text-gray-400">
                생성일: {formatDate(directoryInfo?.createdAt)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto p-4 sm:p-6 md:p-8">
        <div className="mb-6">
          {/* Information */}
          <h2 className="text-xl font-semibold mb-4">📄 정보</h2>
          <div className="bg-base-200 p-4 rounded-md">
            <p className="text-sm text-gray-400">
              {directoryInfo?.description || "사용자가 설정한 설명이 없습니다."}
            </p>
            <p
              className="btn btn-sm btn-primary mt-2"
              onClick={(e) =>
                window.navigator.clipboard
                  .writeText(window.location.href)
                  .then(() => alert("공유 링크가 클립보드에 복사되었습니다."))
              }
            >
              공유 링크 복사
            </p>
            <p className="text-sm text-gray-400 mt-2">
              디렉토리 ID: <span className="font-mono">{directoryId}</span>
            </p>
            <p className="text-sm text-gray-400 mt-2">
              파일 수: {files.length}개, 하위 디렉토리 수:{" "}
              {subdirectories.length}개
            </p>
            <p className="alert alert-warning mt-2">
              ⚠️ 이 디렉토리는 공유 링크로 공개되어 있습니다. 링크를 아는 사람은{" "}
              {new Date(expiresAt).toLocaleString()}까지 누구나 접근할 수
              있습니다.
            </p>
            <p className="alert alert-success mt-2">
              ℹ️ 상위 디렉토리로의 이동은 디렉토리 명 위의 브레드크럼을 클릭하여
              가능합니다.
            </p>
            <p className="alert alert-success mt-2">
              ℹ️ 공유 디렉토리에서의 파일 검색 기능은 추후 추가될 예정입니다.
            </p>
            <p className="alert alert-success mt-2">
              ℹ️ 자신이 업로드한 파일을 관리하려면{" "}
              <Link
                href="/my-uploads"
                className="text-red-600 hover:text-blue-800"
              >
                내 업로드
              </Link>
            </p>
          </div>
        </div>

        {/* Subdirectories */}
        {subdirectories.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4">📁 하위 디렉토리</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {subdirectories.map((directory) => (
                <div
                  key={directory.id}
                  className="card bg-base-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer min-w-0"
                  onClick={() => handleDirectoryClick(directory.name)}
                >
                  <div className="card-body p-4">
                    <div className="flex items-center">
                      <span className="text-2xl mr-3 flex-shrink-0">📁</span>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium hover:text-blue-600 break-words word-break-all leading-tight">
                          {directory.name}
                        </h3>
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
          {permission === "write" && directoryId && (
            <div className="w-auto mb-4">
              <div className="w-auto mb-4 flex gap-2">
                <CreateSharedDirectory
                  parentId={directoryId}
                  shareHash={hash}
                  onSuccess={handleUploadComplete}
                />
                {directoryInfo.isOwner && (
                  <DeleteSharedDirectory directoryId={directoryId} />
                )}
              </div>
              <div className="w-auto mb-4">
                <FileUploader
                  directoryId={directoryId}
                  shareHash={hash}
                  onUploadComplete={handleUploadComplete}
                  buttonText="파일 업로드"
                  className="btn btn-primary btn-sm"
                />
              </div>
            </div>
          )}
          <h2 className="text-xl font-semibold mb-4">📂 파일 목록</h2>
          {files.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📂</div>
              <p className="text-gray-600">이 디렉토리에는 파일이 없습니다.</p>
            </div>
          ) : (
            <>
              {/* 벌크 액션 컨트롤러를 위한 커스텀 버튼들 */}
              <div className="flex justify-between items-center mb-4">
                <div className="flex gap-2">
                  <button
                    className="btn btn-sm btn-outline"
                    onClick={() => setIsSelectionMode(!isSelectionMode)}
                  >
                    {isSelectionMode ? "선택 취소" : "파일 선택"}
                  </button>

                  {isSelectionMode && (
                    <>
                      <button
                        className="btn btn-sm btn-outline"
                        onClick={() => {
                          if (selectedFiles.length === files.length) {
                            setSelectedFiles([]);
                          } else {
                            setSelectedFiles(files.map((file) => file.id));
                          }
                        }}
                      >
                        {selectedFiles.length === files.length
                          ? "전체 해제"
                          : "전체 선택"}
                      </button>

                      {selectedFiles.length > 0 && (
                        <button
                          className="btn btn-sm btn-primary"
                          onClick={() => {
                            console.log("선택된 파일들:", selectedFiles);
                            console.log(
                              "파일 목록:",
                              files.map((f) => ({ id: f.id, name: f.name }))
                            );
                            setShowSelectedDownloadModal(true);
                          }}
                          disabled={isDownloading}
                        >
                          다운로드 ({selectedFiles.length})
                        </button>
                      )}
                    </>
                  )}
                </div>

                {files.length > 0 && (
                  <button
                    className="btn btn-sm btn-outline"
                    onClick={() => setShowBulkDownloadModal(true)}
                    disabled={isDownloading}
                  >
                    📦 전체 다운로드
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                {files.map((file) => {
                  const isSelected = selectedFiles.includes(file.id);
                  return (
                    <div
                      key={file.id}
                      className={`card shadow-sm hover:shadow-md transition-shadow cursor-pointer min-w-0 ${
                        isSelected
                          ? "bg-primary/20 border-2 border-primary"
                          : "bg-base-200"
                      }`}
                      onClick={(e) => {
                        if (isSelectionMode) {
                          // 선택 모드에서는 파일 선택/해제만
                          toggleFileSelection(file.id);
                        } else {
                          // 일반 모드에서는 파일 클릭 (미리보기/다운로드)
                          handleFileClick(file, e);
                        }
                      }}
                    >
                      <div className="card-body p-4">
                        <div className="flex items-center">
                          {isSelectionMode && (
                            <input
                              type="checkbox"
                              className="checkbox checkbox-primary mr-3"
                              checked={isSelected}
                              onChange={(e) => {
                                e.stopPropagation();
                                toggleFileSelection(file.id);
                              }}
                            />
                          )}
                          <span className="text-2xl mr-3 flex-shrink-0">
                            {file.isWebGLBuild
                              ? "🎮"
                              : (
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
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium hover:text-blue-600 break-words word-break-all leading-tight">
                              {file.name}
                              {file.isEncrypted && (
                                <span className="ml-2">
                                  <span className="badge badge-warning badge-sm">
                                    🔒
                                  </span>
                                </span>
                              )}
                            </h3>
                            <div className="text-sm text-gray-600">
                              <p>{formatFileSize(file.size)}</p>
                              <p>{formatDate(file.uploadedAt)}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="bg-base-200 py-4 mt-12">
        <div className="container mx-auto px-4 sm:px-6 md:px-8 text-center">
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
      <PreviewModal
        isOpen={!!previewModal}
        onClose={() => setPreviewModal(null)}
        file={previewModal?.file}
        url={previewModal?.url}
        mimeType={previewModal?.mimeType}
        isDecrypted={previewModal?.isDecrypted}
      />

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
            <p className="text-sm mb-6">{errorModal.message}</p>
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

      {/* 선택 다운로드 모달 */}
      <SelectedDownloadModal
        isOpen={showSelectedDownloadModal}
        onClose={() => {
          setShowSelectedDownloadModal(false);
          setSelectedFiles([]);
          setIsSelectionMode(false);
        }}
        selectedFiles={selectedFiles}
        onClearSelection={() => {
          setSelectedFiles([]);
          setIsSelectionMode(false);
        }}
        // 공유 파일용 커스텀 액션 함수 전달
        getFilesAction={async (fileIds) => {
          console.log("선택된 파일 IDs:", fileIds);
          console.log("공유 해시:", hash);
          const { getSharedSelectedFilesForDownload } = await import(
            "@/actions/share"
          );
          const result = await getSharedSelectedFilesForDownload({
            shareHash: hash,
            fileIds: fileIds,
          });
          console.log("서버 액션 결과:", result);
          return result;
        }}
      />

      {/* 전체 다운로드 모달 */}
      <BulkDownloadModal
        isOpen={showBulkDownloadModal}
        onClose={() => setShowBulkDownloadModal(false)}
        directoryId={directoryId}
        directoryName={directoryInfo?.name || "공유 디렉토리"}
        // 공유 파일용 커스텀 액션 함수 전달
        getFilesAction={async (dirId) => {
          const { getSharedAllFilesForDownload } = await import(
            "@/actions/share"
          );
          return getSharedAllFilesForDownload({
            shareHash: hash,
            directoryId: dirId,
          });
        }}
      />

      {/* WebGL 게임 선택 모달 (게임 플레이 or 다운로드) */}
      {showWebGLModal && webGLFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-base-100 rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">🎮 WebGL 게임</h2>

            <p className="text-sm text-gray-600 mb-2">
              <strong>{webGLFile.name}</strong>
            </p>
            <p className="text-sm text-gray-500 mb-6">
              이 파일은 WebGL 빌드입니다. 게임을 플레이하거나 다운로드할 수
              있습니다.
            </p>

            {webGLFile.isEncrypted && (
              <div className="alert alert-warning mb-4">
                <span className="text-sm">
                  🔒 이 게임은 암호화되어 있습니다. 플레이하려면 복호화
                  비밀번호가 필요합니다.
                </span>
              </div>
            )}

            <div className="flex flex-col gap-3">
              <button
                className="btn btn-primary btn-block"
                onClick={handleWebGLPlay}
                disabled={webGLLoading}
              >
                {webGLFile.isEncrypted
                  ? "🔒 복호화 후 게임 플레이"
                  : "🎮 게임 플레이"}
              </button>
              <button
                className="btn btn-secondary btn-block"
                onClick={handleWebGLDownload}
              >
                ⬇️ 다운로드
              </button>
              <button
                className="btn btn-ghost btn-block"
                onClick={() => {
                  setShowWebGLModal(false);
                  setWebGLFile(null);
                }}
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WebGL 게임 플레이용 암호화 파일 비밀번호 입력 모달 */}
      {webGLPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-base-100 rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">🔒 게임 복호화</h2>

            <p className="text-sm text-gray-600 mb-4">
              이 게임은 암호화되어 있습니다. 게임을 플레이하려면 복호화
              비밀번호를 입력해주세요.
            </p>

            <div className="form-control mb-4">
              <label className="label">
                <span className="label-text">복호화 비밀번호</span>
              </label>
              <input
                type="password"
                placeholder="비밀번호를 입력하세요"
                className="input input-bordered"
                value={webGLPassword}
                onChange={(e) => setWebGLPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleWebGLPlayWithPassword();
                  }
                }}
                disabled={webGLLoading}
              />
            </div>

            <div className="flex gap-2 justify-end">
              <button
                className="btn btn-ghost"
                onClick={() => {
                  setWebGLPasswordModal(false);
                  setWebGLPassword("");
                  setWebGLFile(null);
                }}
                disabled={webGLLoading}
              >
                취소
              </button>
              <button
                className={`btn btn-primary ${webGLLoading ? "loading" : ""}`}
                onClick={handleWebGLPlayWithPassword}
                disabled={webGLLoading || !webGLPassword.trim()}
              >
                {webGLLoading ? "복호화 중..." : "게임 시작"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WebGL 플레이어 모달 */}
      {showWebGLPlayer && webGLBlob && webGLFile && (
        <SharedWebGLPlayer
          isOpen={showWebGLPlayer}
          onClose={() => {
            setShowWebGLPlayer(false);
            setWebGLBlob(null);
            setWebGLFile(null);
          }}
          file={webGLFile}
          fileBlob={webGLBlob}
        />
      )}
    </div>
  );
}
