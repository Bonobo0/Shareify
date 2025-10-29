"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { getFileDetails, getFileDownloadUrl } from "@/actions/files";
import { downloadAndDecrypt } from "@/lib/crypto/encryption";
import { loadWebGLBuild, clearWebGLCache } from "@/lib/webgl/player";

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

  useEffect(() => {
    if (authLoading) return;

    if (!isAuthenticated) {
      router.push("/user/signin");
      return;
    }

    if (hash) {
      fetchFileDetails();
    }
  }, [hash, isAuthenticated, authLoading, router]);

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
        
        // 암호화되지 않은 파일은 바로 로드 시작
        if (!fileData.isEncrypted) {
          await loadGame();
        }
      }
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

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
        const JSZip = (await import("jszip")).default;
        const decryptedData = await downloadAndDecrypt(
          result.downloadUrl,
          password,
          metadata
        );

        if (decryptedData.error) {
          throw new Error(decryptedData.error);
        }

        // Blob으로 변환
        fileBlob = new Blob([decryptedData], { type: "application/zip" });
        
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

  const handleClearCache = async () => {
    if (confirm("캐시를 삭제하시겠습니까? 다음에 다시 다운로드해야 합니다.")) {
      await clearWebGLCache(file.originalName);
      alert("캐시가 삭제되었습니다.");
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
      <main className="flex min-h-screen flex-col p-4">
        <div className="mb-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">{file?.originalName}</h1>
          <div className="flex gap-2">
            {gameReady && (
              <button className="btn btn-sm" onClick={handleClearCache}>
                🗑️ 캐시 삭제
              </button>
            )}
            <button
              className="btn btn-sm"
              onClick={() => router.push(`/file/${hash}`)}
            >
              ← 파일 정보
            </button>
          </div>
        </div>

        {!gameReady && !file?.isEncrypted && (
          <div className="card bg-base-200 p-6 mb-4">
            <button
              className="btn btn-primary"
              onClick={() => loadGame()}
              disabled={gameLoading}
            >
              {gameLoading ? "게임 로딩 중..." : "게임 시작"}
            </button>
          </div>
        )}

        {file?.isEncrypted && !gameReady && (
          <div className="card bg-base-200 p-6 mb-4">
            <p className="mb-4">이 게임은 암호화되어 있습니다. 게임을 플레이하려면 복호화 키를 입력해주세요.</p>
            <button
              className="btn btn-primary"
              onClick={() => setDecryptModal(true)}
              disabled={gameLoading}
            >
              게임 시작
            </button>
          </div>
        )}

        {gameLoading && (
          <div className="card bg-base-200 p-6 mb-4">
            <div className="text-center">
              <p className="mb-2">게임 로딩 중... {Math.round(loadProgress)}%</p>
              <progress
                className="progress progress-primary w-full"
                value={loadProgress}
                max="100"
              ></progress>
            </div>
          </div>
        )}

        {/* 게임 컨테이너 */}
        <div
          id="game-container"
          className="w-full bg-black rounded-lg overflow-hidden"
          style={{
            aspectRatio: "16/9",
            display: gameReady ? "block" : "none",
          }}
        ></div>

        {!gameReady && !gameLoading && (
          <div className="card bg-base-200 p-6 text-center">
            <p className="text-gray-500">게임을 시작하려면 위의 버튼을 클릭하세요</p>
          </div>
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
