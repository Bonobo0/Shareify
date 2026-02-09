"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useAuth } from "@/context/AuthContext";
import {
  getEditorFiles,
  createEditorFile,
  completeEditorFileCreation,
  getFileDownloadUrl,
} from "@/actions/files";
import { createPreviewUrl } from "@/lib/downloadUtils";
import { encryptFile } from "@/lib/crypto/encryption";
import DirectoryTreePicker from "@/app/components/directoryTreePicker";

const LiveEditor = dynamic(() => import("@/app/components/liveEditor"), {
  ssr: false,
  loading: () => (
    <div className="flex flex-col items-center justify-center py-12 gap-3">
      <span className="loading loading-spinner loading-lg"></span>
      <p className="text-sm opacity-60">에디터 로딩 중...</p>
    </div>
  ),
});

export default function EditorPage() {
  const router = useRouter();
  const { user, loading: authLoading, isAuthenticated } = useAuth();

  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // 현재 편집 중인 파일
  const [currentFile, setCurrentFile] = useState(null);
  const [currentFileUrl, setCurrentFileUrl] = useState(null);

  // 새 파일 생성 모달
  const [showNewFileModal, setShowNewFileModal] = useState(false);
  const [newFileName, setNewFileName] = useState("");
  const [creating, setCreating] = useState(false);
  const [newFileEncrypted, setNewFileEncrypted] = useState(false);
  const [newFilePassword, setNewFilePassword] = useState("");
  const [newFileDirectoryId, setNewFileDirectoryId] = useState(null);

  // Alert 모달
  const [alertModal, setAlertModal] = useState({ show: false, message: "" });

  const fetchFiles = useCallback(async () => {
    try {
      const result = await getEditorFiles();
      if (result.error) {
        setError(result.error);
        return;
      }
      setFiles(result.files || []);
    } catch (err) {
      setError("파일 목록을 불러올 수 없습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      router.push("/user/signin");
      return;
    }
    fetchFiles();
  }, [authLoading, isAuthenticated, router, fetchFiles]);

  const handleOpenFile = async (file) => {
    try {
      setError("");
      const result = await getFileDownloadUrl({
        fileId: file.id,
        asPreview: true,
      });
      if (result.error) {
        setAlertModal({ show: true, message: result.error });
        return;
      }

      const previewResult = await createPreviewUrl({
        downloadUrl: result.downloadUrl,
        forceBlob: true,
      });

      if (previewResult.error) {
        setAlertModal({ show: true, message: previewResult.error });
        return;
      }

      setCurrentFile(file);
      setCurrentFileUrl(previewResult.url);
    } catch (err) {
      setAlertModal({ show: true, message: "파일을 열 수 없습니다." });
    }
  };

  const handleCloseEditor = () => {
    if (currentFileUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(currentFileUrl);
    }
    setCurrentFile(null);
    setCurrentFileUrl(null);
    fetchFiles();
  };

  const handleOpenNewFileModal = async () => {
    setShowNewFileModal(true);
  };

  const handleCloseNewFileModal = () => {
    setShowNewFileModal(false);
    setNewFileName("");
    setNewFileEncrypted(false);
    setNewFilePassword("");
    setNewFileDirectoryId(null);
  };

  const handleCreateFile = async () => {
    if (!newFileName.trim()) {
      setAlertModal({ show: true, message: "파일 이름을 입력해주세요." });
      return;
    }

    if (newFileEncrypted && !newFilePassword.trim()) {
      setAlertModal({ show: true, message: "암호화 비밀번호를 입력해주세요." });
      return;
    }

    setCreating(true);
    try {
      const result = await createEditorFile({
        filename: newFileName.trim(),
        directoryId: newFileDirectoryId,
        isEncrypted: newFileEncrypted,
      });
      if (result.error) {
        setAlertModal({ show: true, message: result.error });
        return;
      }

      let uploadBody = result.initialData;
      let contentType = "application/json";

      // 암호화 처리
      if (newFileEncrypted) {
        const blob = new Blob([result.initialData], {
          type: "application/json",
        });
        const file = new window.File([blob], newFileName.trim() + ".ejtxt", {
          type: "application/json",
        });
        const encryptResult = await encryptFile(file, newFilePassword.trim());
        if (!encryptResult.success) {
          setAlertModal({
            show: true,
            message: encryptResult.error || "암호화에 실패했습니다.",
          });
          return;
        }
        uploadBody = encryptResult.encryptedFile;
        contentType = "application/octet-stream";
      }

      // 초기 데이터 업로드
      const uploadResponse = await fetch(result.uploadUrl, {
        method: "PUT",
        body: uploadBody,
        headers: { "Content-Type": contentType },
      });

      if (!uploadResponse.ok) {
        setAlertModal({ show: true, message: "파일 업로드에 실패했습니다." });
        return;
      }

      // 업로드 완료 처리
      const completeResult = await completeEditorFileCreation({
        fileId: result.file.id,
      });
      if (completeResult.error) {
        setAlertModal({ show: true, message: completeResult.error });
        return;
      }

      setShowNewFileModal(false);
      setNewFileName("");
      setNewFileEncrypted(false);
      setNewFilePassword("");
      setNewFileDirectoryId(null);

      // 생성된 파일 바로 열기
      await fetchFiles();
      await handleOpenFile(result.file);
    } catch (err) {
      setAlertModal({
        show: true,
        message: "파일 생성 중 오류가 발생했습니다.",
      });
    } finally {
      setCreating(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "";
    return new Date(dateString).toLocaleString("ko-KR");
  };

  const formatBytes = (bytes) => {
    if (!bytes) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  if (authLoading || loading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center">
        <div className="loading loading-spinner loading-lg"></div>
      </main>
    );
  }

  // 에디터 모드
  if (currentFile && currentFileUrl) {
    return (
      <main className="flex min-h-screen flex-col p-2 sm:p-4 md:p-8">
        <div className="flex items-center gap-2 mb-4">
          <button className="btn btn-ghost btn-sm" onClick={handleCloseEditor}>
            ← 돌아가기
          </button>
          <h1 className="text-lg font-bold truncate">
            {currentFile.originalName}
          </h1>
        </div>
        <div className="card bg-base-200 p-4">
          <LiveEditor
            file={currentFile}
            fileUrl={currentFileUrl}
            onClose={handleCloseEditor}
          />
        </div>
      </main>
    );
  }

  // 파일 목록 모드
  return (
    <main className="flex min-h-screen flex-col p-2 sm:p-4 md:p-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">에디터</h1>
          <p className="text-sm opacity-60 mt-1">
            .ejtxt 문서를 만들고 편집하세요
          </p>
        </div>
        <button
          className="btn btn-primary btn-sm sm:btn-md"
          onClick={() => handleOpenNewFileModal()}
        >
          ✏️ 새 문서
        </button>
      </div>

      {error && (
        <div className="alert alert-error mb-4">
          <span>{error}</span>
        </div>
      )}

      {files.length === 0 ? (
        <div className="card bg-base-200 p-8 text-center">
          <p className="text-lg opacity-60 mb-4">아직 문서가 없습니다</p>
          <p className="text-sm opacity-40 mb-6">
            새 문서를 만들거나 대시보드에서 .ejtxt 파일을 업로드하세요
          </p>
          <button
            className="btn btn-primary btn-sm mx-auto"
            onClick={() => handleOpenNewFileModal()}
          >
            ✏️ 첫 문서 만들기
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {files.map((file) => (
            <div
              key={file.id}
              className="card bg-base-200 hover:bg-base-300 cursor-pointer transition-colors"
              onClick={() => handleOpenFile(file)}
            >
              <div className="card-body p-4">
                <h2 className="card-title text-sm sm:text-base truncate">
                  📝 {file.originalName}
                </h2>
                <div className="flex items-center justify-between text-xs opacity-60">
                  <span>{formatBytes(file.size)}</span>
                  <span>{formatDate(file.updatedAt || file.createdAt)}</span>
                </div>
                {file.isEncrypted && (
                  <div className="badge badge-primary badge-xs mt-1">
                    🔒 암호화
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 새 파일 생성 모달 */}
      {showNewFileModal && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg">새 문서 만들기</h3>
            <div className="form-control mt-4">
              <label className="label">
                <span className="label-text">문서 이름</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  className="input input-bordered flex-1"
                  placeholder="문서 이름을 입력하세요"
                  value={newFileName}
                  onChange={(e) => setNewFileName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreateFile();
                  }}
                  autoFocus
                />
                <span className="text-sm opacity-60">.ejtxt</span>
              </div>
            </div>

            {/* 저장 위치 선택 */}
            <div className="form-control mt-4">
              <label className="label">
                <span className="label-text">저장 위치</span>
              </label>
              <DirectoryTreePicker
                value={newFileDirectoryId}
                onChange={setNewFileDirectoryId}
              />
            </div>

            {/* 암호화 토글 */}
            <div className="form-control mt-4">
              <label className="label cursor-pointer justify-start gap-3">
                <input
                  type="checkbox"
                  className="toggle toggle-primary"
                  checked={newFileEncrypted}
                  onChange={(e) => {
                    setNewFileEncrypted(e.target.checked);
                    if (!e.target.checked) setNewFilePassword("");
                  }}
                />
                <span className="label-text">🔒 암호화</span>
              </label>
            </div>

            {/* 암호화 비밀번호 */}
            {newFileEncrypted && (
              <div className="form-control mt-2">
                <label className="label">
                  <span className="label-text">암호화 비밀번호</span>
                </label>
                <input
                  type="password"
                  className="input input-bordered"
                  placeholder="비밀번호를 입력하세요"
                  value={newFilePassword}
                  onChange={(e) => setNewFilePassword(e.target.value)}
                />
                <label className="label">
                  <span className="label-text-alt text-warning">
                    ⚠️ 비밀번호를 분실하면 파일을 복구할 수 없습니다
                  </span>
                </label>
              </div>
            )}

            <div className="modal-action">
              <button
                className="btn"
                onClick={handleCloseNewFileModal}
                disabled={creating}
              >
                취소
              </button>
              <button
                className={`btn btn-primary ${creating ? "loading" : ""}`}
                onClick={handleCreateFile}
                disabled={
                  creating ||
                  !newFileName.trim() ||
                  (newFileEncrypted && !newFilePassword.trim())
                }
              >
                만들기
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
    </main>
  );
}
