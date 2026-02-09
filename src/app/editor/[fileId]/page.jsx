"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useAuth } from "@/context/AuthContext";
import {
  getFileDownloadUrl,
  toggleEditorShareLink,
  getEditorFileById,
} from "@/actions/files";
import { createPreviewUrl } from "@/lib/downloadUtils";
import { decryptFile } from "@/lib/crypto/encryption";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faLink, faArrowLeft, faCheck, faLock } from "@fortawesome/free-solid-svg-icons";

const LiveEditor = dynamic(() => import("@/app/components/liveEditor"), {
  ssr: false,
  loading: () => (
    <div className="flex flex-col items-center justify-center py-12 gap-3">
      <span className="loading loading-spinner loading-lg"></span>
      <p className="text-sm opacity-60">에디터 로딩 중...</p>
    </div>
  ),
});

export default function EditorFilePage() {
  const router = useRouter();
  const params = useParams();
  const { fileId } = params;
  const { user, loading: authLoading, isAuthenticated } = useAuth();

  const [file, setFile] = useState(null);
  const [fileUrl, setFileUrl] = useState(null);
  const [encryptionPassword, setEncryptionPassword] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // 복호화 비밀번호 모달
  const [decryptModal, setDecryptModal] = useState(false);
  const [decryptPassword, setDecryptPassword] = useState("");
  const [decrypting, setDecrypting] = useState(false);

  // Alert 모달
  const [alertModal, setAlertModal] = useState({ show: false, message: "" });

  // 공유 링크 상태
  const [shareModal, setShareModal] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [sharingLoading, setSharingLoading] = useState(false);
  const [copiedShare, setCopiedShare] = useState(false);

  const loadFile = useCallback(async () => {
    try {
      const result = await getEditorFileById({ fileId });
      if (result.error) {
        setError(result.error);
        return;
      }
      const fileData = result.file;
      setFile(fileData);

      if (fileData.isEncrypted) {
        // 암호화된 파일은 비밀번호 입력 모달 표시
        setDecryptModal(true);
        setLoading(false);
        return;
      }

      // 비암호화 파일 로드
      const downloadResult = await getFileDownloadUrl({
        fileId: fileData.id,
        asPreview: true,
      });
      if (downloadResult.error) {
        setError(downloadResult.error);
        return;
      }

      const previewResult = await createPreviewUrl({
        downloadUrl: downloadResult.downloadUrl,
        forceBlob: true,
      });
      if (previewResult.error) {
        setError(previewResult.error);
        return;
      }

      setFileUrl(previewResult.url);
    } catch (err) {
      setError("파일을 불러올 수 없습니다.");
    } finally {
      setLoading(false);
    }
  }, [fileId]);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      router.push("/user/signin");
      return;
    }
    loadFile();
  }, [authLoading, isAuthenticated, router, loadFile]);

  // 암호화된 파일 복호화 후 열기
  const handleDecryptAndOpen = async () => {
    if (!decryptPassword.trim()) {
      setAlertModal({ show: true, message: "복호화 비밀번호를 입력해주세요." });
      return;
    }

    setDecrypting(true);
    try {
      const result = await getFileDownloadUrl({
        fileId: file.id,
        asPreview: true,
      });
      if (result.error) {
        setAlertModal({ show: true, message: result.error });
        return;
      }

      const response = await fetch(result.downloadUrl);
      if (!response.ok) throw new Error("파일 다운로드 실패");
      const encryptedBuffer = await response.arrayBuffer();

      const decryptResult = await decryptFile(
        encryptedBuffer,
        decryptPassword.trim(),
        {
          originalName: file.originalName,
          originalType: file.originalMimetype || "application/json",
        },
      );

      if (!decryptResult.success) {
        setAlertModal({
          show: true,
          message: decryptResult.error || "복호화에 실패했습니다. 비밀번호를 확인해주세요.",
        });
        return;
      }

      const decryptedBlob = new Blob(
        [await decryptResult.decryptedFile.arrayBuffer()],
        { type: "application/json" },
      );
      const blobUrl = URL.createObjectURL(decryptedBlob);

      setFileUrl(blobUrl);
      setEncryptionPassword(decryptPassword.trim());
      setDecryptModal(false);
      setDecryptPassword("");
    } catch (err) {
      console.error("복호화 오류:", err);
      setAlertModal({
        show: true,
        message: "복호화 중 오류가 발생했습니다. 비밀번호를 확인해주세요.",
      });
    } finally {
      setDecrypting(false);
    }
  };

  // 공유 링크 토글
  const handleToggleShare = async () => {
    if (!file) return;
    setSharingLoading(true);
    try {
      const result = await toggleEditorShareLink({ fileId: file.id });
      if (result.error) {
        setAlertModal({ show: true, message: result.error });
        return;
      }

      setFile((prev) => ({ ...prev, isPublic: result.isPublic }));

      if (result.isPublic && result.shareUrl) {
        setShareUrl(result.shareUrl);
        setShareModal(true);
      } else {
        setShareModal(false);
        setShareUrl("");
        setAlertModal({ show: true, message: "공유 링크가 해제되었습니다." });
      }
    } catch (err) {
      setAlertModal({ show: true, message: "공유 설정 중 오류가 발생했습니다." });
    } finally {
      setSharingLoading(false);
    }
  };

  const handleCopyShareUrl = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopiedShare(true);
    setTimeout(() => setCopiedShare(false), 2000);
  };

  const handleGoBack = () => {
    if (fileUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(fileUrl);
    }
    router.push("/editor");
  };

  if (authLoading || loading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center">
        <div className="loading loading-spinner loading-lg"></div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-8">
        <div className="alert alert-error mb-4">
          <span>{error}</span>
        </div>
        <button className="btn btn-primary" onClick={() => router.push("/editor")}>
          <FontAwesomeIcon icon={faArrowLeft} /> 목록으로 돌아가기
        </button>
      </main>
    );
  }

  // 복호화 대기 상태
  if (decryptModal && !fileUrl) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-4">
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg"><FontAwesomeIcon icon={faLock} /> 암호화된 문서</h3>
            <p className="text-sm opacity-60 mt-1 truncate">
              {file?.originalName}
            </p>
            <p className="text-sm mt-3">
              이 문서는 암호화되어 있습니다. 복호화 비밀번호를 입력해주세요.
            </p>
            <div className="form-control mt-4">
              <input
                type="password"
                className="input input-bordered"
                placeholder="비밀번호를 입력하세요"
                value={decryptPassword}
                onChange={(e) => setDecryptPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleDecryptAndOpen();
                }}
                autoFocus
                disabled={decrypting}
              />
            </div>
            <div className="modal-action">
              <button
                className="btn"
                onClick={handleGoBack}
                disabled={decrypting}
              >
                취소
              </button>
              <button
                className={`btn btn-primary ${decrypting ? "loading" : ""}`}
                onClick={handleDecryptAndOpen}
                disabled={decrypting || !decryptPassword.trim()}
              >
                열기
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col p-2 sm:p-4 md:p-8">
      <div className="flex items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2 min-w-0">
          <button
            className="btn btn-ghost btn-sm"
            onClick={handleGoBack}
          >
            <FontAwesomeIcon icon={faArrowLeft} /> 돌아가기
          </button>
          <h1 className="text-lg font-bold truncate">
            {file?.originalName}
          </h1>
        </div>
        <button
          className={`btn btn-sm ${file?.isPublic ? "btn-warning" : "btn-outline"}`}
          onClick={handleToggleShare}
          disabled={sharingLoading}
          title={file?.isPublic ? "공유 링크 관리" : "공유 링크 생성"}
        >
          {sharingLoading ? (
            <span className="loading loading-spinner loading-xs"></span>
          ) : (
            <><FontAwesomeIcon icon={faLink} /> {file?.isPublic ? "공유 중" : "공유"}</>
          )}
        </button>
      </div>
      <div className="card bg-base-200 p-4">
        <LiveEditor
          file={file}
          fileUrl={fileUrl}
          encryptionPassword={encryptionPassword}
          onClose={handleGoBack}
        />
      </div>

      {/* 공유 모달 */}
      {shareModal && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg"><FontAwesomeIcon icon={faLink} /> 공유 링크</h3>
            <p className="text-sm opacity-60 mt-1 truncate">
              {file?.originalName}
            </p>
            <div className="form-control mt-4">
              <div className="join w-full">
                <input
                  type="text"
                  className="input input-bordered join-item flex-1"
                  value={shareUrl}
                  readOnly
                />
                <button
                  className={`btn join-item ${copiedShare ? "btn-success" : "btn-primary"}`}
                  onClick={handleCopyShareUrl}
                >
                  {copiedShare ? <><FontAwesomeIcon icon={faCheck} /> 복사됨</> : "복사"}
                </button>
              </div>
              <label className="label">
                <span className="label-text-alt opacity-60">
                  이 링크를 통해 누구나 문서를 읽기 전용으로 볼 수 있습니다.
                </span>
              </label>
            </div>
            <div className="modal-action">
              <button
                className="btn btn-error btn-sm"
                onClick={handleToggleShare}
                disabled={sharingLoading}
              >
                공유 해제
              </button>
              <button
                className="btn"
                onClick={() => {
                  setShareModal(false);
                  setShareUrl("");
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
    </main>
  );
}
