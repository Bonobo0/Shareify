"use client";

import { useState, useEffect, useCallback } from "react";
import { loadWebGLBuild } from "@/lib/webgl/player";

/**
 * WebGL 게임 플레이어 컴포넌트
 * /play/[hash]/page.jsx와 공유 페이지에서 범용적으로 사용
 * @param {Object} props
 * @param {boolean} props.isOpen - 플레이어 표시 여부
 * @param {Function} props.onClose - 닫기 콜백
 * @param {Object} props.file - 파일 정보
 * @param {Blob} props.fileBlob - 다운로드된 파일 Blob (WebGL 빌드 ZIP)
 * @param {boolean} props.showBackButton - 뒤로가기 버튼 표시 여부 (기본: false)
 * @param {Function} props.onBack - 뒤로가기 콜백
 * @param {boolean} props.isOwner - 파일 소유자 여부 (기본: false)
 * @param {boolean} props.isPublic - 공개 상태 (기본: false)
 * @param {string} props.shareUrl - 공유 URL
 * @param {Function} props.onTogglePublic - 공개 토글 콜백
 * @param {Function} props.onCopyShareUrl - 공유 URL 복사 콜백
 */
export default function WebGLPlayer({ 
  isOpen, 
  onClose, 
  file, 
  fileBlob,
  showBackButton = false,
  onBack,
  isOwner = false,
  isPublic = false,
  shareUrl = "",
  onTogglePublic,
  onCopyShareUrl,
}) {
  const [gameLoading, setGameLoading] = useState(false);
  const [gameReady, setGameReady] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [error, setError] = useState("");
  const [showOverlay, setShowOverlay] = useState(true);

  const containerIdRef = useState(() => 
    `game-container-${Math.random().toString(36).slice(2, 11)}`
  )[0];

  const startGame = useCallback(async () => {
    setGameLoading(true);
    setLoadProgress(0);
    setError("");

    try {
      // WebGL 빌드 로드
      await loadWebGLBuild(
        fileBlob,
        file.originalName || file.name,
        containerIdRef,
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
  }, [fileBlob, file, containerIdRef]);

  useEffect(() => {
    if (isOpen && fileBlob && !gameReady && !gameLoading) {
      startGame();
    }
  }, [isOpen, fileBlob, gameReady, gameLoading, startGame]);

  const handleClose = () => {
    setGameReady(false);
    setLoadProgress(0);
    setError("");
    onClose();
  };

  const handleBackClick = () => {
    if (onBack) {
      onBack();
    } else {
      handleClose();
    }
  };

  if (!isOpen) return null;

  const overlayClasses = `absolute top-0 left-0 right-0 bg-gradient-to-b from-black/70 to-transparent p-4 transition-opacity duration-300 z-50 ${
    showOverlay ? 'opacity-100' : 'opacity-0 hover:opacity-100'
  }`;

  return (
    <div className="fixed inset-0 z-50 bg-black">
      {/* 전체 화면 게임 컨테이너 - /play/[hash]/page.jsx 구조 따름 */}
      <div className="relative w-full h-full overflow-hidden">
        {/* 로딩/에러 오버레이 */}
        {!gameReady && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-base-100 z-10">
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

            {error && (
              <div className="card bg-base-200 p-6 max-w-md">
                <div className="alert alert-error mb-4">
                  <span>{error}</span>
                </div>
                <div className="text-center">
                  <button className="btn btn-primary" onClick={handleClose}>
                    닫기
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 게임 컨테이너 - /play/[hash]/page.jsx와 동일한 구조 */}
        <div
          id={containerIdRef}
          style={{
            width: "100%",
            height: "100%",
            display: gameReady ? "block" : "none",
          }}
        ></div>

        {/* 오버레이 컨트롤 - 게임 실행 중에만 표시 */}
        {gameReady && (
          <div className={overlayClasses}>
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <button
                  className="btn btn-sm btn-ghost"
                  onClick={handleBackClick}
                  title={showBackButton ? "뒤로가기" : "닫기"}
                >
                  {showBackButton ? "← 뒤로가기" : "✕ 닫기"}
                </button>
                <h1 className="text-white text-lg font-bold hidden sm:block">
                  {file?.originalName || file?.name}
                </h1>
              </div>
              
              <div className="flex items-center gap-2">
                {isOwner && onTogglePublic && (
                  <>
                    <div className="flex items-center gap-2 bg-base-100/80 backdrop-blur rounded-lg px-3 py-1">
                      <span className="text-sm hidden sm:inline">공개 공유</span>
                      <input
                        type="checkbox"
                        className="toggle toggle-primary toggle-sm"
                        checked={isPublic}
                        onChange={onTogglePublic}
                        title="공개 공유 설정"
                      />
                    </div>
                    {isPublic && shareUrl && onCopyShareUrl && (
                      <button
                        className="btn btn-sm btn-primary"
                        onClick={onCopyShareUrl}
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
        )}
      </div>
    </div>
  );
}
