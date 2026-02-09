"use client";

import { useState, useEffect } from "react";
import { shareFile, removeFileShare, getFileDetails } from "@/actions/files";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faXmark } from "@fortawesome/free-solid-svg-icons";
import {
  shareDirectory,
  removeDirectoryShare,
  getDirectoryDetails,
} from "@/actions/directories";
import { toggleFilePublic } from "@/actions/share";

export default function ShareModal({
  file,
  directory,
  isOpen,
  onClose,
  onUpdate,
}) {
  const [email, setEmail] = useState("");
  const [permission, setPermission] = useState("read");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [localFile, setLocalFile] = useState(null); // 로컬 파일 상태
  const [successTimeout, setSuccessTimeout] = useState(null); // 성공 메시지 타이머

  // 확인 모달 상태
  const [confirmModal, setConfirmModal] = useState({
    show: false,
    message: "",
    callback: null,
  });

  const item = localFile || file || directory;
  const isFile = !!file;

  // activeTab 초기화
  const [activeTab, setActiveTab] = useState(() => {
    return isFile ? "public" : "user";
  });

  // 성공 메시지 설정 함수 (타이머 포함)
  const setSuccessWithTimer = (message) => {
    clearMessages(); // 기존 타이머와 메시지 클리어
    setSuccess(message);
    const timeout = setTimeout(() => {
      setSuccess("");
      setSuccessTimeout(null);
    }, 5000);
    setSuccessTimeout(timeout);
  };

  // 파일이 변경될 때 로컬 상태 업데이트 (성공 메시지는 유지)
  useEffect(() => {
    if (file) {
      setLocalFile(file);
    }
  }, [file]);

  // 모달이 열릴 때마다 폼 상태 초기화 (성공 메시지는 모달이 새로 열릴 때만 초기화)
  useEffect(() => {
    if (isOpen) {
      setEmail("");
      setPermission("read");
      setActiveTab(isFile ? "public" : "user");
      if (file) {
        setLocalFile(file);
      }
    } else {
      // 모달이 닫힐 때 모든 상태 초기화
      setError("");
      setSuccess("");
      if (successTimeout) {
        clearTimeout(successTimeout);
        setSuccessTimeout(null);
      }
    }
  }, [isOpen, file, successTimeout, isFile]);

  const handleShare = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      let result;
      if (isFile) {
        result = await shareFile({
          fileId: file.id,
          email,
          permission,
        });
      } else {
        result = await shareDirectory({
          directoryId: directory.id,
          email,
          permission,
        });
      }

      if (result.error) {
        throw new Error(result.error);
      }

      setSuccessWithTimer(
        `${email}에게 ${isFile ? "파일" : "디렉토리"}이 공유되었습니다.`
      );
      setEmail("");

      // 로컬 상태 업데이트 (즉시 반영)
      if (isFile && file) {
        const updatedFileResult = await getFileDetails({ fileId: file.id });
        if (updatedFileResult.success && updatedFileResult.file) {
          setLocalFile(updatedFileResult.file);
        }
      } else if (!isFile && directory) {
        const updatedDirResult = await getDirectoryDetails({
          directoryId: directory.id,
        });
        if (updatedDirResult.success && updatedDirResult.directory) {
          setLocalFile(updatedDirResult.directory);
        }
      }

      // 부모 컴포넌트 데이터 새로고침
      if (onUpdate) {
        await onUpdate();
      }
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const removeShare = async (shareId, userEmail) => {
    setConfirmModal({
      show: true,
      message: `${userEmail}님과의 공유를 해제하시겠습니까?`,
      callback: async () => {
        setLoading(true);
        setError("");
        setSuccess("");

        try {
          let result;
          if (isFile) {
            result = await removeFileShare({
              fileId: file.id,
              shareId,
            });
          } else {
            result = await removeDirectoryShare({
              directoryId: directory.id,
              shareId,
            });
          }

          if (result.error) {
            throw new Error(result.error);
          }

          setSuccessWithTimer(`${userEmail}의 공유가 해제되었습니다.`);

          // 로컬 상태 업데이트 (즉시 반영)
          if (isFile && file) {
            const updatedFileResult = await getFileDetails({ fileId: file.id });
            if (updatedFileResult.success && updatedFileResult.file) {
              setLocalFile(updatedFileResult.file);
            }
          } else if (!isFile && directory) {
            const updatedDirResult = await getDirectoryDetails({
              directoryId: directory.id,
            });
            if (updatedDirResult.success && updatedDirResult.directory) {
              setLocalFile(updatedDirResult.directory);
            }
          }

          // 부모 컴포넌트 데이터 새로고침
          if (onUpdate) {
            await onUpdate();
          }
        } catch (error) {
          setError(error.message);
        } finally {
          setLoading(false);
        }
      },
    });
  };

  const togglePublic = async () => {
    if (!isFile) return;

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const result = await toggleFilePublic({ fileId: file.id });

      if (result.error) {
        throw new Error(result.error);
      }

      setSuccessWithTimer(result.message);

      // 로컬 상태 즉시 업데이트 (깜빡임 방지)
      setLocalFile((prev) =>
        prev
          ? {
              ...prev,
              isPublic: !prev.isPublic,
            }
          : null
      );

      // 부모 컴포넌트 데이터 새로고침
      if (onUpdate) {
        await onUpdate();
      }
    } catch (error) {
      setError(error.message);
      // 오류 발생 시 로컬 상태 되돌리기
      setLocalFile(file);
    } finally {
      setLoading(false);
    }
  };

  const copyShareUrl = () => {
    const shareUrl = `${window.location.origin}/share/${item.hash}`;
    navigator.clipboard.writeText(shareUrl);
    setSuccessWithTimer("공유 링크가 클립보드에 복사되었습니다.");
  };

  const clearMessages = () => {
    if (successTimeout) {
      clearTimeout(successTimeout);
      setSuccessTimeout(null);
    }
    setError("");
    setSuccess("");
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="modal modal-open">
        <div className="modal-box max-w-4xl">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-lg">
              {isFile ? "파일" : "디렉토리"} 공유
            </h3>
            <button className="btn btn-sm btn-circle" onClick={onClose}>
              <FontAwesomeIcon icon={faXmark} />
            </button>
          </div>

          <div className="mb-4">
            <p className="text-sm text-gray-600">
              <span className="font-medium">
                {item?.originalName || item?.name}
              </span>{" "}
              {isFile ? "파일을" : "디렉토리를"} 공유합니다.
            </p>
          </div>

          {/* 탭 메뉴 */}
          <div className="tabs tabs-boxed mb-6">
            {isFile && (
              <button
                className={`tab ${activeTab === "public" ? "tab-active" : ""}`}
                onClick={() => setActiveTab("public")}
              >
                링크 공유
              </button>
            )}
            <button
              className={`tab ${activeTab === "user" ? "tab-active" : ""}`}
              onClick={() => setActiveTab("user")}
            >
              사용자 공유
            </button>
          </div>

          {error && (
            <div className="alert alert-error mb-4">
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="alert alert-success mb-4">
              <span>{success}</span>
            </div>
          )}

          {/* 링크 공유 탭 */}
          {activeTab === "public" && isFile && (
            <>
              {/* 공개 링크 생성/관리 */}
              <div className="card bg-base-200 mb-6">
                <div className="card-body">
                  <h4 className="card-title text-base">공개 링크 관리</h4>

                  {item?.isPublic ? (
                    <div className="space-y-3">
                      <div className="form-control">
                        <label className="label">
                          <span className="label-text">공개 링크</span>
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            className="input input-bordered flex-1 text-sm font-mono"
                            value={`${window.location.origin}/share/${item.hash}`}
                            readOnly
                          />
                          <button
                            className="btn btn-primary px-6"
                            onClick={copyShareUrl}
                            disabled={loading}
                          >
                            복사
                          </button>
                        </div>
                      </div>
                      <button
                        className={`btn btn-outline btn-sm w-full ${
                          loading ? "loading" : ""
                        }`}
                        onClick={togglePublic}
                        disabled={loading}
                      >
                        공개 해제
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="alert alert-info">
                        <span>이 파일은 현재 비공개 상태입니다.</span>
                      </div>
                      <button
                        className={`btn btn-primary w-full ${
                          loading ? "loading" : ""
                        }`}
                        onClick={togglePublic}
                        disabled={loading}
                      >
                        공개 링크 생성
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* 사용자 공유 탭 */}
          {activeTab === "user" && (
            <>
              {/* 새 사용자 공유 */}
              <div className="card bg-base-200 mb-6">
                <div className="card-body">
                  <h4 className="card-title text-base">사용자와 공유</h4>

                  <form onSubmit={handleShare}>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="form-control md:col-span-2">
                        <label className="label">
                          <span className="label-text">사용자 이메일</span>
                        </label>
                        <input
                          type="email"
                          placeholder="user@example.com"
                          className="input input-bordered"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                          disabled={loading}
                        />
                      </div>

                      <div className="form-control">
                        <label className="label">
                          <span className="label-text">권한</span>
                        </label>
                        <select
                          className="select select-bordered"
                          value={permission}
                          onChange={(e) => setPermission(e.target.value)}
                          disabled={loading}
                        >
                          <option value="read">읽기 전용</option>
                          <option value="admin">관리자</option>
                        </select>
                      </div>
                    </div>

                    <div className="card-actions justify-end mt-4">
                      <button
                        type="submit"
                        className={`btn btn-primary ${
                          loading ? "loading" : ""
                        }`}
                        disabled={loading || !email}
                      >
                        {loading ? "공유 중..." : "사용자와 공유"}
                      </button>
                    </div>
                  </form>
                </div>
              </div>

              {/* 공유된 사용자 목록 */}
              <div>
                <h4 className="font-semibold mb-4">공유된 사용자</h4>

                {item?.sharedWith && item.sharedWith.length > 0 ? (
                  <div className="space-y-3">
                    {item.sharedWith.map((share, index) => (
                      <div
                        key={index}
                        className="card bg-base-100 border border-base-300"
                      >
                        <div className="card-body p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div>
                                <div className="font-medium">
                                  {share.user?.name ||
                                    share.user?.email ||
                                    share.userId}
                                </div>
                                {share.user?.name && (
                                  <div className="text-sm text-gray-500">
                                    {share.user.email}
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <div
                                className={`btn btn-xs ${
                                  share.permission === "admin"
                                    ? "btn-error"
                                    : "btn-info"
                                }`}
                              >
                                {share.permission === "admin"
                                  ? "관리자"
                                  : "읽기 전용"}
                              </div>
                              <button
                                className="btn btn-sm btn-error"
                                onClick={() =>
                                  removeShare(
                                    share._id,
                                    share.user?.email || share.userId
                                  )
                                }
                                disabled={loading}
                              >
                                공유 해제
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    공유된 사용자가 없습니다.
                  </div>
                )}
              </div>
            </>
          )}

          <div className="modal-action">
            <button className="btn" onClick={onClose} disabled={loading}>
              닫기
            </button>
          </div>
        </div>

        {/* 확인 모달 */}
        {confirmModal.show && (
          <div className="modal modal-open">
            <div className="modal-box">
              <h3 className="font-bold text-lg">확인</h3>
              <p className="py-4">{confirmModal.message}</p>
              <div className="modal-action">
                <button
                  className="btn btn-outline"
                  onClick={() =>
                    setConfirmModal({
                      show: false,
                      message: "",
                      callback: null,
                    })
                  }
                >
                  취소
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    if (confirmModal.callback) {
                      confirmModal.callback();
                    }
                    setConfirmModal({
                      show: false,
                      message: "",
                      callback: null,
                    });
                  }}
                >
                  확인
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
