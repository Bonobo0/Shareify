"use client";

import { useState, useEffect, useCallback } from "react";
import {
  createDirectoryShareLink,
  getDirectoryShareLinks,
  deleteDirectoryShareLink,
  shareDirectory,
  unshareDirectory,
  getDirectorySharedUsers,
} from "@/actions/directories";

export default function DirectoryShareModal({
  isOpen,
  onClose,
  directoryId,
  directoryName,
}) {
  const [activeTab, setActiveTab] = useState("link"); // "link" 또는 "user"
  const [shareLinks, setShareLinks] = useState([]);
  const [sharedUsers, setSharedUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [permission, setPermission] = useState("read");
  const [expiresIn, setExpiresIn] = useState(7);
  const [userEmail, setUserEmail] = useState("");
  const [userPermission, setUserPermission] = useState("read");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // 확인 모달 상태
  const [confirmModal, setConfirmModal] = useState({
    show: false,
    message: "",
    callback: null,
  });

  const fetchShareLinks = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getDirectoryShareLinks({ directoryId });
      if (result.success) {
        setShareLinks(result.shareLinks);
      } else {
        setError(result.error);
      }
    } catch (error) {
      setError("공유 링크를 불러오는데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }, [directoryId]);

  const fetchSharedUsers = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getDirectorySharedUsers({ directoryId });
      if (result.success) {
        setSharedUsers(result.users);
      } else {
        setError(result.error);
      }
    } catch (error) {
      setError("공유된 사용자를 불러오는데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }, [directoryId]);

  useEffect(() => {
    if (isOpen && directoryId) {
      if (activeTab === "link") {
        fetchShareLinks();
      } else if (activeTab === "user") {
        fetchSharedUsers();
      }
    }
  }, [isOpen, directoryId, activeTab, fetchShareLinks, fetchSharedUsers]);

  const handleCreateShare = async () => {
    setCreating(true);
    setError("");
    setSuccess("");

    try {
      const result = await createDirectoryShareLink({
        directoryId,
        permission,
        expiresIn,
      });

      if (result.success) {
        await fetchShareLinks();
        // 클립보드에 복사
        try {
          await navigator.clipboard.writeText(result.shareUrl);
          setSuccess("공유 링크가 생성되고 클립보드에 복사되었습니다.");
        } catch (clipboardError) {
          setSuccess("공유 링크가 생성되었습니다.");
        }
      } else {
        setError(result.error || "공유 링크 생성에 실패했습니다.");
      }
    } catch (error) {
      console.error("공유 링크 생성 오류:", error);
      setError("공유 링크 생성 중 오류가 발생했습니다.");
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteShare = async (shareHash) => {
    setConfirmModal({
      show: true,
      message: "이 공유 링크를 삭제하시겠습니까?",
      callback: async () => {
        try {
          const result = await deleteDirectoryShareLink({
            directoryId,
            shareHash,
          });
          if (result.success) {
            setSuccess(result.message);
            await fetchShareLinks();
          } else {
            setError(result.error);
          }
        } catch (error) {
          setError("공유 링크 삭제에 실패했습니다.");
        }
      },
    });
  };

  const handleShareWithUser = async () => {
    if (!userEmail.trim()) {
      setError("이메일을 입력해주세요.");
      return;
    }

    setSharing(true);
    setError("");
    setSuccess("");

    try {
      const result = await shareDirectory({
        directoryId,
        targetUserEmail: userEmail.trim(),
        permission: userPermission,
      });

      if (result.success) {
        setSuccess("사용자와 디렉토리가 공유되었습니다.");
        setUserEmail("");
        await fetchSharedUsers();
      } else {
        setError(result.error);
      }
    } catch (error) {
      setError("사용자 공유에 실패했습니다.");
    } finally {
      setSharing(false);
    }
  };

  const handleUnshareUser = async (userId) => {
    setConfirmModal({
      show: true,
      message: "이 사용자와의 공유를 해제하시겠습니까?",
      callback: async () => {
        try {
          const result = await unshareDirectory({
            directoryId,
            targetUserId: userId,
          });
          if (result.success) {
            setSuccess(result.message);
            await fetchSharedUsers();
          } else {
            setError(result.error);
          }
        } catch (error) {
          setError("공유 해제에 실패했습니다.");
        }
      },
    });
  };

  const copyToClipboard = async (url) => {
    try {
      await navigator.clipboard.writeText(url);
      setSuccess("링크가 클립보드에 복사되었습니다.");
    } catch (error) {
      setError("클립보드 복사에 실패했습니다.");
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (!isOpen) return null;

  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-4xl">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-lg">디렉토리 공유</h3>
          <button className="btn btn-sm btn-circle" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="mb-4">
          <p className="text-sm text-gray-600">
            <span className="font-medium">{directoryName}</span> 폴더를
            공유합니다.
          </p>
        </div>

        {/* 탭 메뉴 */}
        <div className="tabs tabs-boxed mb-6">
          <button
            className={`tab ${activeTab === "link" ? "tab-active" : ""}`}
            onClick={() => setActiveTab("link")}
          >
            링크 공유
          </button>
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
        {activeTab === "link" && (
          <>
            {/* 새 공유 링크 생성 */}
            <div className="card bg-base-200 mb-6">
              <div className="card-body">
                <h4 className="card-title text-base">새 공유 링크 생성</h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">권한</span>
                    </label>
                    <select
                      className="select select-bordered"
                      value={permission}
                      onChange={(e) => setPermission(e.target.value)}
                    >
                      <option value="read">읽기 전용</option>
                      <option value="write">읽기/쓰기</option>
                    </select>
                  </div>

                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">만료 기간</span>
                    </label>
                    <select
                      className="select select-bordered"
                      value={expiresIn}
                      onChange={(e) => setExpiresIn(parseInt(e.target.value))}
                    >
                      <option value={1}>1일</option>
                      <option value={3}>3일</option>
                      <option value={7}>7일</option>
                      <option value={14}>14일</option>
                      <option value={30}>30일</option>
                    </select>
                  </div>
                </div>

                <div className="card-actions justify-end mt-4">
                  <button
                    className={`btn btn-primary ${creating ? "loading" : ""}`}
                    onClick={handleCreateShare}
                    disabled={creating}
                  >
                    {creating ? "생성 중..." : "공유 링크 생성"}
                  </button>
                </div>
              </div>
            </div>

            {/* 기존 공유 링크 목록 */}
            <div>
              <h4 className="font-semibold mb-4">기존 공유 링크</h4>

              {loading ? (
                <div className="flex justify-center py-8">
                  <div className="loading loading-spinner loading-lg"></div>
                </div>
              ) : shareLinks.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  생성된 공유 링크가 없습니다.
                </div>
              ) : (
                <div className="space-y-3">
                  {shareLinks.map((link) => (
                    <div
                      key={link.hash}
                      className={`card bg-base-100 border ${
                        link.expired ? "border-error" : "border-base-300"
                      }`}
                    >
                      <div className="card-body p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <div
                                className={`btn btn-xs ${
                                  link.permission === "read"
                                    ? "btn-info"
                                    : "btn-warning"
                                }`}
                              >
                                {link.permission === "read"
                                  ? "읽기 전용"
                                  : "읽기/쓰기"}
                              </div>
                              {link.expired && (
                                <div className="btn btn-xs btn-error">
                                  만료됨
                                </div>
                              )}
                            </div>

                            <div className="font-mono text-sm bg-base-200 p-2 rounded break-all">
                              {link.shareUrl}
                            </div>

                            <div className="text-xs text-gray-500 mt-2">
                              생성: {formatDate(link.createdAt)} | 만료:{" "}
                              {formatDate(link.expiresAt)}
                            </div>
                          </div>

                          <div className="flex gap-2 ml-4">
                            <button
                              className="btn btn-sm btn-outline"
                              onClick={() => copyToClipboard(link.shareUrl)}
                              disabled={link.expired}
                            >
                              복사
                            </button>
                            <button
                              className="btn btn-sm btn-error"
                              onClick={() => handleDeleteShare(link.hash)}
                            >
                              삭제
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
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

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="form-control md:col-span-2">
                    <label className="label">
                      <span className="label-text">사용자 이메일</span>
                    </label>
                    <input
                      type="email"
                      className="input input-bordered"
                      placeholder="user@example.com"
                      value={userEmail}
                      onChange={(e) => setUserEmail(e.target.value)}
                    />
                  </div>

                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">권한</span>
                    </label>
                    <select
                      className="select select-bordered"
                      value={userPermission}
                      onChange={(e) => setUserPermission(e.target.value)}
                    >
                      <option value="read">읽기 전용</option>
                      <option value="write">읽기/쓰기</option>
                      <option value="admin">관리자</option>
                    </select>
                  </div>
                </div>

                <div className="card-actions justify-end mt-4">
                  <button
                    className={`btn btn-primary ${sharing ? "loading" : ""}`}
                    onClick={handleShareWithUser}
                    disabled={sharing || !userEmail.trim()}
                  >
                    {sharing ? "공유 중..." : "사용자와 공유"}
                  </button>
                </div>
              </div>
            </div>

            {/* 공유된 사용자 목록 */}
            <div>
              <h4 className="font-semibold mb-4">공유된 사용자</h4>

              {loading ? (
                <div className="flex justify-center py-8">
                  <div className="loading loading-spinner loading-lg"></div>
                </div>
              ) : sharedUsers.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  공유된 사용자가 없습니다.
                </div>
              ) : (
                <div className="space-y-3">
                  {sharedUsers.map((user) => (
                    <div
                      key={user.userId}
                      className="card bg-base-100 border border-base-300"
                    >
                      <div className="card-body p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div>
                              <div className="font-medium">
                                {user.user.name || user.user.email}
                              </div>
                              {user.user.name && (
                                <div className="text-sm text-gray-500">
                                  {user.user.email}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <div
                              className={`btn btn-xs ${
                                user.permission === "read"
                                  ? "btn-info"
                                  : user.permission === "write"
                                  ? "btn-warning"
                                  : "btn-error"
                              }`}
                            >
                              {user.permission === "read"
                                ? "읽기 전용"
                                : user.permission === "write"
                                ? "읽기/쓰기"
                                : "관리자"}
                            </div>
                            <button
                              className="btn btn-sm btn-error"
                              onClick={() => handleUnshareUser(user.userId)}
                            >
                              공유 해제
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        <div className="modal-action">
          <button className="btn" onClick={onClose}>
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
                  setConfirmModal({ show: false, message: "", callback: null })
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
                  setConfirmModal({ show: false, message: "", callback: null });
                }}
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
