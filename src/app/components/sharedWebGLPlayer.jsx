"use client";

import { useState, useEffect } from "react";
import { loadWebGLBuild } from "@/lib/webgl/player";

/**
 * 공유 파일용 WebGL 플레이어 모달 컴포넌트
 * @param {Object} props
 * @param {boolean} props.isOpen - 모달 표시 여부
 * @param {Function} props.onClose - 모달 닫기 콜백
 * @param {Object} props.file - 파일 정보
 * @param {Blob} props.fileBlob - 다운로드된 파일 Blob (WebGL 빌드 ZIP)
 */
export default function SharedWebGLPlayer({ isOpen, onClose, file, fileBlob }) {
  const [gameLoading, setGameLoading] = useState(false);
  const [gameReady, setGameReady] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen && fileBlob && !gameReady && !gameLoading) {
      startGame();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, fileBlob]);

  const startGame = async () => {
    setGameLoading(true);
    setLoadProgress(0);
    setError("");

    try {
      // WebGL 빌드 로드
      await loadWebGLBuild(
        fileBlob,
        file.originalName || file.name,
        "shared-game-container",
        (progress) => {
          setLoadProgress(progress);
        }
      );

      setGameReady(true);
    } catch (err) {
      console.error("게임 로드 오류:", err);
      setError(err.message || "게임을 로드하는 중 오류가 발생했습니다.");
    } finally {
      setGameLoading(false);
    }
  };

  const handleClose = () => {
    setGameReady(false);
    setLoadProgress(0);
    setError("");
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-90 p-4">
      <div className="bg-base-100 rounded-lg w-full max-w-7xl max-h-[95vh] overflow-auto">
        {/* 헤더 */}
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-xl font-bold">{file?.originalName || file?.name}</h2>
          <button
            className="btn btn-ghost btn-sm"
            onClick={handleClose}
          >
            ✕
          </button>
        </div>

        {/* 로딩 상태 */}
        {gameLoading && (
          <div className="p-6 text-center">
            <div className="loading loading-spinner loading-lg mb-4"></div>
            <p className="mb-2">게임 로딩 중... {Math.round(loadProgress)}%</p>
            <progress
              className="progress progress-primary w-full max-w-md"
              value={loadProgress}
              max="100"
            ></progress>
          </div>
        )}

        {/* 에러 상태 */}
        {error && (
          <div className="p-6">
            <div className="alert alert-error">
              <span>{error}</span>
            </div>
            <div className="mt-4 text-center">
              <button className="btn btn-primary" onClick={handleClose}>
                닫기
              </button>
            </div>
          </div>
        )}

        {/* 게임 컨테이너 */}
        {!error && (
          <div className="p-4">
            <div
              id="shared-game-container"
              className="w-full bg-black rounded-lg overflow-hidden"
              style={{
                aspectRatio: "16/9",
                display: gameReady ? "block" : gameLoading ? "none" : "block",
                minHeight: gameReady ? "500px" : "300px",
              }}
            >
              {!gameReady && !gameLoading && (
                <div className="flex items-center justify-center h-full text-white">
                  <p>게임을 준비 중입니다...</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
