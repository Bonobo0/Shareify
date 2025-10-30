"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { getFileDetails, getFileDownloadUrl } from "@/actions/files";
import { decryptFile } from "@/lib/crypto/encryption";
import { toggleFilePublic } from "@/actions/share";
import WebGLPlayer from "@/app/components/webGLPlayer";

export default function PlayPage() {
  const params = useParams();
  const router = useRouter();
  const { hash } = params;
  const { isAuthenticated, loading: authLoading } = useAuth();

  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [decryptModal, setDecryptModal] = useState(false);
  const [decryptPassword, setDecryptPassword] = useState("");
  const [decryptLoading, setDecryptLoading] = useState(false);
  const [isPublic, setIsPublic] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [isOwner, setIsOwner] = useState(false);
  const [showGamePlayer, setShowGamePlayer] = useState(false);
  const [gameBlob, setGameBlob] = useState(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);

  const fetchFileDetails = async () => {
    try {
      const result = await getFileDetails({ hash });

      if (result.error) {
        throw new Error(result.error);
      }

      if (result.success) {
        const fileData = result.file;
        
        // WebGL 빌드인지 확인
        if (!fileData.isWebGLBuild) {
          setError("이 파일은 WebGL 빌드가 아닙니다.");
          setLoading(false);
          return;
        }

        setFile(fileData);
        setIsPublic(fileData.isPublic);
        setIsOwner(fileData.userPermission === "admin");
        
        if (fileData.isPublic) {
          setShareUrl(`${window.location.origin}/share/${hash}`);
        }
      }
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;

    if (!isAuthenticated) {
      router.push("/user/signin");
      return;
    }

    if (hash) {
      fetchFileDetails();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hash, isAuthenticated, authLoading, router]);

  const downloadWithProgress = async (url, onProgress) => {
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error("파일 다운로드에 실패했습니다.");
    }

    const contentLength = response.headers.get('content-length');
    const total = parseInt(contentLength, 10);
    let loaded = 0;

    const reader = response.body.getReader();
    const chunks = [];

    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      chunks.push(value);
      loaded += value.length;

      if (total && onProgress) {
        const progress = (loaded / total) * 100;
        onProgress(Math.round(progress));
      }
    }

    const arrayBuffer = new Uint8Array(
      chunks.reduce((acc, chunk) => acc + chunk.length, 0)
    );
    let position = 0;
    for (const chunk of chunks) {
      arrayBuffer.set(chunk, position);
      position += chunk.length;
    }

    return arrayBuffer.buffer;
  };

  const loadGame = async (password = null) => {
    try {
      setIsDownloading(true);
      setDownloadProgress(0);
      
      // 다운로드 URL 가져오기
      const result = await getFileDownloadUrl({ fileId: file.id });

      if (result.error) {
        throw new Error(result.error);
      }

      let fileBlob;

      // 암호화된 파일인 경우 복호화
      if (file.isEncrypted) {
        if (!password) {
          setIsDownloading(false);
          setDecryptModal(true);
          return;
        }
        
        const metadata = {
          originalName: file.originalName,
          originalType: file.originalMimetype,
          originalSize: file.originalSize,
        };

        // 파일 다운로드 및 진행률 추적
        const encryptedArrayBuffer = await downloadWithProgress(
          result.downloadUrl,
          setDownloadProgress
        );

        setDownloadProgress(100);

        // 복호화
        const decryptResult = await decryptFile(
          encryptedArrayBuffer,
          password,
          metadata
        );

        if (!decryptResult.success || decryptResult.error) {
          throw new Error(decryptResult.error || "복호화에 실패했습니다.");
        }

        // Blob으로 변환 (decryptedFile은 File 객체이므로 직접 사용 가능)
        fileBlob = decryptResult.decryptedFile;
        
        setDecryptModal(false);
        setDecryptPassword("");
      } else {
        // 일반 파일 다운로드 (진행률 추적)
        const arrayBuffer = await downloadWithProgress(
          result.downloadUrl,
          setDownloadProgress
        );
        
        fileBlob = new Blob([arrayBuffer]);
        setDownloadProgress(100);
      }

      // WebGL 플레이어 표시
      setGameBlob(fileBlob);
      setShowGamePlayer(true);
      setIsDownloading(false);
    } catch (error) {
      console.error("게임 로드 오류:", error);
      setError(error.message || "게임을 로드하는 중 오류가 발생했습니다.");
      setIsDownloading(false);
      setDownloadProgress(0);
    }
  };

  const handleDecryptAndLoad = async () => {
    if (!decryptPassword) {
      alert("복호화 키를 입력해주세요.");
      return;
    }

    setDecryptLoading(true);
    try {
      await loadGame(decryptPassword);
    } catch (error) {
      alert(error.message);
    } finally {
      setDecryptLoading(false);
    }
  };

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
          alert("공개 링크가 활성화되었습니다.");
        } else {
          setShareUrl("");
          alert("공개 링크가 비활성화되었습니다.");
        }
      }
    } catch (error) {
      alert(error.message);
    }
  };

  const copyShareUrl = () => {
    if (shareUrl) {
      navigator.clipboard.writeText(shareUrl);
      alert("공유 링크가 클립보드에 복사되었습니다.");
    }
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
      <main className="flex min-h-screen flex-col p-8">
        <div className="alert alert-error">{error}</div>
        <button
          className="btn btn-primary mt-4"
          onClick={() => router.push("/dashboard")}
        >
          대시보드로 돌아가기
        </button>
      </main>
    );
  }

  return (
    <>
      {!showGamePlayer && (
        <main className="flex min-h-screen flex-col items-center justify-center">
          <div className="card bg-base-200 p-6 max-w-md">
            <h2 className="text-2xl font-bold mb-4">{file?.originalName}</h2>
            
            {isDownloading ? (
              <div className="text-center">
                <p className="mb-4">파일 다운로드 중... {downloadProgress}%</p>
                <progress
                  className="progress progress-primary w-full"
                  value={downloadProgress}
                  max="100"
                ></progress>
              </div>
            ) : file?.isEncrypted ? (
              <>
                <p className="mb-4">이 게임은 암호화되어 있습니다. 게임을 플레이하려면 복호화 키를 입력해주세요.</p>
                <button
                  className="btn btn-primary"
                  onClick={() => setDecryptModal(true)}
                >
                  🎮 게임 시작
                </button>
              </>
            ) : (
              <button
                className="btn btn-primary"
                onClick={() => loadGame()}
              >
                🎮 게임 시작
              </button>
            )}
          </div>
        </main>
      )}

      {/* WebGL 플레이어 */}
      {showGamePlayer && gameBlob && (
        <WebGLPlayer
          isOpen={showGamePlayer}
          onClose={() => {
            setShowGamePlayer(false);
            setGameBlob(null);
          }}
          file={file}
          fileBlob={gameBlob}
          showBackButton={true}
          onBack={() => router.back()}
          isOwner={isOwner}
          isPublic={isPublic}
          shareUrl={shareUrl}
          onTogglePublic={togglePublicAccess}
          onCopyShareUrl={copyShareUrl}
        />
      )}

      {/* 복호화 모달 */}
      {decryptModal && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg">게임 복호화</h3>
            <p className="py-4">
              이 게임은 암호화되어 있습니다. 복호화 키를 입력해주세요.
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
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleDecryptAndLoad();
                  }
                }}
                disabled={decryptLoading}
              />
            </div>

            <div className="modal-action">
              <button
                className="btn"
                onClick={() => {
                  setDecryptModal(false);
                  setDecryptPassword("");
                }}
                disabled={decryptLoading}
              >
                취소
              </button>
              <button
                className={`btn btn-primary ${decryptLoading ? "loading" : ""}`}
                onClick={handleDecryptAndLoad}
                disabled={decryptLoading || !decryptPassword.trim()}
              >
                {decryptLoading ? "처리 중..." : "게임 시작"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
