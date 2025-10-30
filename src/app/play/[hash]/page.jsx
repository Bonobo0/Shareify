"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { getFileDetails, getFileDownloadUrl } from "@/actions/files";
import { decryptFile } from "@/lib/crypto/encryption";
import { loadWebGLBuild } from "@/lib/webgl/player";
import { toggleFilePublic } from "@/actions/share";

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
  const [gameLoading, setGameLoading] = useState(false);
  const [gameReady, setGameReady] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [isPublic, setIsPublic] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [isOwner, setIsOwner] = useState(false);
  const [showOverlay, setShowOverlay] = useState(true);

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

  const loadGame = async (password = null) => {
    setGameLoading(true);
    setLoadProgress(0);

    try {
      // 다운로드 URL 가져오기
      const result = await getFileDownloadUrl({ fileId: file.id });

      if (result.error) {
        throw new Error(result.error);
      }

      let fileBlob;

      // 암호화된 파일인 경우 복호화
      if (file.isEncrypted) {
        if (!password) {
          setDecryptModal(true);
          setGameLoading(false);
          return;
        }

        setLoadProgress(10);
        
        const metadata = {
          originalName: file.originalName,
          originalType: file.originalMimetype,
          originalSize: file.originalSize,
        };

        // 파일 다운로드 및 복호화
        const response = await fetch(result.downloadUrl);
        const encryptedArrayBuffer = await response.arrayBuffer();
        
        setLoadProgress(30);

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
        // 일반 파일 다운로드
        setLoadProgress(10);
        const response = await fetch(result.downloadUrl);
        fileBlob = await response.blob();
      }

      setLoadProgress(50);

      // WebGL 빌드 로드
      await loadWebGLBuild(
        fileBlob,
        file.originalName,
        "game-container",
        (progress) => {
          setLoadProgress(50 + progress * 0.5);
        }
      );

      setLoadProgress(100);
      setGameReady(true);
    } catch (error) {
      console.error("게임 로드 오류:", error);
      setError(error.message || "게임을 로드하는 중 오류가 발생했습니다.");
    } finally {
      setGameLoading(false);
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
      {/* 전체 화면 게임 컨테이너 */}
      <main className="relative w-screen h-screen overflow-hidden">
        {!gameReady && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-base-100 z-10">
            {!gameLoading && !file?.isEncrypted && (
              <div className="card bg-base-200 p-6 max-w-md">
                <h2 className="text-2xl font-bold mb-4">{file?.originalName}</h2>
                <button
                  className="btn btn-primary"
                  onClick={() => loadGame()}
                >
                  🎮 게임 시작
                </button>
              </div>
            )}

            {file?.isEncrypted && !gameReady && !gameLoading && (
              <div className="card bg-base-200 p-6 max-w-md">
                <h2 className="text-2xl font-bold mb-4">{file?.originalName}</h2>
                <p className="mb-4">이 게임은 암호화되어 있습니다. 게임을 플레이하려면 복호화 키를 입력해주세요.</p>
                <button
                  className="btn btn-primary"
                  onClick={() => setDecryptModal(true)}
                >
                  🎮 게임 시작
                </button>
              </div>
            )}

            {gameLoading && (
              <div className="card bg-base-200 p-6 max-w-md">
                <div className="text-center">
                  <p className="mb-2 text-lg">게임 로딩 중... {Math.round(loadProgress)}%</p>
                  <progress
                    className="progress progress-primary w-full"
                    value={loadProgress}
                    max="100"
                  ></progress>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 게임 컨테이너 - 커스텀 스타일 없이 */}
        <div
          id="game-container"
          style={{
            width: "100%",
            height: "100%",
            display: gameReady ? "block" : "none",
          }}
        ></div>

        {/* 오버레이 컨트롤 - 게임 실행 중에만 표시 */}
        {gameReady && (
          <>
            {/* 상단 오버레이 - 항상 표시되거나 호버 시 표시 */}
            <div 
              className={`absolute top-0 left-0 right-0 bg-gradient-to-b from-black/70 to-transparent p-4 transition-opacity duration-300 z-50 ${showOverlay ? 'opacity-100' : 'opacity-0 hover:opacity-100'}`}
            >
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <button
                    className="btn btn-sm btn-ghost"
                    onClick={() => router.back()}
                    title="뒤로가기"
                  >
                    ← 뒤로가기
                  </button>
                  <h1 className="text-white text-lg font-bold hidden sm:block">{file?.originalName}</h1>
                </div>
                
                <div className="flex items-center gap-2">
                  {isOwner && (
                    <>
                      <div className="flex items-center gap-2 bg-base-100/80 backdrop-blur rounded-lg px-3 py-1">
                        <span className="text-sm hidden sm:inline">공개 공유</span>
                        <input
                          type="checkbox"
                          className="toggle toggle-primary toggle-sm"
                          checked={isPublic}
                          onChange={togglePublicAccess}
                          title="공개 공유 설정"
                        />
                      </div>
                      {isPublic && shareUrl && (
                        <button
                          className="btn btn-sm btn-primary"
                          onClick={copyShareUrl}
                          title="공유 링크 복사"
                        >
                          🔗 링크 복사
                        </button>
                      )}
                    </>
                  )}
                  <button
                    className="btn btn-sm btn-ghost"
                    onClick={() => setShowOverlay(!showOverlay)}
                    title={showOverlay ? "컨트롤 숨기기" : "컨트롤 보이기"}
                  >
                    {showOverlay ? "👁️" : "👁️‍🗨️"}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </main>

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
