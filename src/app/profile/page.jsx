"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

import StorageInfo from "../components/storageInfo";
import TwoFactorSetup from "../components/twoFactorSetup";
import ThemeSelector from "../components/themeSelector";
import { useAuth } from "@/context/AuthContext";
import {
  getUserInfo,
  updateUserProfile,
  changePassword,
  deleteAccount,
  cleanupStorage,
} from "@/actions/user";
import {
  listSessions,
  revokeSessionByJti,
  revokeOtherSessions,
  revokeAllSessions,
} from "@/actions/auth";
import { sendEmailVerification } from "@/actions/verification";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUser, faFloppyDisk, faLock } from "@fortawesome/free-solid-svg-icons";

export default function ProfilePage() {
  const router = useRouter();
  const {
    user,
    loading: authLoading,
    isAuthenticated,
    logout,
    refreshUser,
  } = useAuth();

  const [activeTab, setActiveTab] = useState("profile");
  const [name, setName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [confirmModal, setConfirmModal] = useState({
    show: false,
    message: "",
    callback: null,
  });
  const [storageInfo, setStorageInfo] = useState({
    used: 0,
    total: 0,
    available: 0,
    percentage: 0,
  });
  const [sendingVerification, setSendingVerification] = useState(false);
  const [sessionUpdating, setSessionUpdating] = useState(false);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);

  // Modal helper functions
  const showConfirm = (message, callback) => {
    setConfirmModal({ show: true, message, callback });
  };

  const hideConfirm = () => {
    setConfirmModal({ show: false, message: "", callback: null });
  };

  const handleConfirm = () => {
    if (confirmModal.callback) {
      confirmModal.callback();
    }
    hideConfirm();
  };

  const handleSendVerification = async () => {
    setSendingVerification(true);
    setError("");
    setSuccess("");
    try {
      const result = await sendEmailVerification();
      if (result.success) {
        setSuccess(result.message);
      } else {
        setError(result.error);
      }
    } catch (error) {
      setError("인증 메일 전송에 실패했습니다.");
    } finally {
      setSendingVerification(false);
    }
  };

  // Initialize data
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/user/signin");
      return;
    }

    if (user) {
      setName(user.name || "");
      fetchUserData();
    }
  }, [authLoading, isAuthenticated, user, router]);

  const fetchUserData = async () => {
    try {
      const result = await getUserInfo();
      if (result.success) {
        setStorageInfo({
          used: result.user.storageUsed,
          total: result.user.storageLimit,
          available: result.user.storageLimit - result.user.storageUsed,
          percentage:
            (result.user.storageUsed / result.user.storageLimit) * 100,
        });
      }
    } catch (error) {
      console.error("사용자 정보 로드 실패:", error);
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setUpdating(true);

    try {
      const result = await updateUserProfile({ name });

      if (result.error) {
        throw new Error(result.error);
      }

      if (result.success) {
        setSuccess(result.message || "프로필이 업데이트되었습니다.");
        await refreshUser(); // 사용자 정보 새로고침
      }
    } catch (error) {
      setError(error.message);
    } finally {
      setUpdating(false);
    }
  };

  const updatePassword = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (newPassword !== confirmPassword) {
      setError("새 비밀번호가 일치하지 않습니다.");
      return;
    }

    if (newPassword.length < 6) {
      setError("새 비밀번호는 최소 6자 이상이어야 합니다.");
      return;
    }

    setUpdating(true);

    try {
      const result = await changePassword({
        currentPassword,
        newPassword,
        confirmPassword,
      });

      if (result.error) {
        throw new Error(result.error);
      }

      if (result.success) {
        setSuccess(result.message);
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch (error) {
      setError(error.message);
    } finally {
      setUpdating(false);
    }
  };

  const handleRevokeSessions = async (mode) => {
    setError("");
    setSuccess("");
    setSessionUpdating(true);

    try {
      const result =
        mode === "all" ? await revokeAllSessions() : await revokeOtherSessions();

      if (result?.error) {
        throw new Error(result.error);
      }

      if (result?.success) {
        setSuccess(result.message);
        if (result.loggedOut) {
          await logout();
          router.push("/user/signin");
        }
      }
    } catch (error) {
      setError(error.message || "세션 로그아웃에 실패했습니다.");
    } finally {
      setSessionUpdating(false);
    }
  };

  const fetchSessions = useCallback(async () => {
    setSessionLoading(true);
    try {
      const result = await listSessions();
      if (result?.success) {
        setSessions(result.sessions || []);
        setCurrentSessionId(result.currentJti || null);
      } else if (result?.error) {
        throw new Error(result.error);
      }
    } catch (error) {
      setError(error.message || "세션 목록을 불러오지 못했습니다.");
    } finally {
      setSessionLoading(false);
    }
  }, []);

  const handleRevokeSession = async (jti) => {
    setError("");
    setSuccess("");
    setSessionUpdating(true);

    try {
      const result = await revokeSessionByJti({ jti });
      if (result?.error) {
        throw new Error(result.error);
      }

      if (result?.success) {
        setSuccess(result.message);
        if (result.loggedOut) {
          await logout();
          router.push("/user/signin");
          return;
        }
        await fetchSessions();
      }
    } catch (error) {
      setError(error.message || "세션 로그아웃에 실패했습니다.");
    } finally {
      setSessionUpdating(false);
    }
  };

  const handleDeleteAccount = () => {
    if (!deletePassword) {
      setError("계정 삭제를 위해 비밀번호를 입력해주세요.");
      return;
    }

    showConfirm(
      "정말로 계정을 삭제하시겠습니까? 이 작업은 되돌릴 수 없으며 모든 데이터가 영구적으로 삭제됩니다.",
      async () => {
        setUpdating(true);
        try {
          const result = await deleteAccount({ password: deletePassword });
          if (result.success) {
            setSuccess("계정이 성공적으로 삭제되었습니다.");
            setTimeout(() => {
              router.push("/");
            }, 2000);
          } else {
            setError(result.error);
          }
        } catch (error) {
          setError("계정 삭제 중 오류가 발생했습니다.");
        } finally {
          setUpdating(false);
        }
      }
    );
  };

  if (authLoading || loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center">
        <div className="loading loading-spinner loading-lg"></div>
        <p className="mt-4 text-lg">로딩 중...</p>
      </div>
    );
  }

  const tabs = [
    { id: "profile", label: "프로필", icon: <FontAwesomeIcon icon={faUser} /> },
    { id: "storage", label: "저장소", icon: <FontAwesomeIcon icon={faFloppyDisk} /> },
    { id: "security", label: "보안", icon: <FontAwesomeIcon icon={faLock} /> },
  ];

  return (
    <>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="section-title">프로필 및 설정</h1>
          <p className="section-subtitle mt-1">계정 정보를 관리하세요</p>
        </div>

          {error && (
            <div className="mb-4 rounded-lg border border-error/30 bg-error/10 px-4 py-3 text-sm text-error">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-4 rounded-lg border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
              {success}
            </div>
          )}

          <div className="flex flex-col gap-6 lg:flex-row">
            {/* 사이드바 */}
            <div className="lg:w-64">
              <div className="card-surface p-2">
                <nav className="flex flex-col gap-1">
                  {tabs.map((tab) => (
                    <button
                      key={tab.id}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                        activeTab === tab.id
                          ? "bg-brand-500/15 text-brand-400"
                          : "text-base-content/60 hover:bg-surface-200 hover:text-base-content"
                      }`}
                      onClick={() => setActiveTab(tab.id)}
                    >
                      {tab.icon}
                      {tab.label}
                    </button>
                  ))}
                </nav>
              </div>
            </div>

            {/* 메인 콘텐츠 */}
            <div className="flex-1">
              <div className="card-surface p-6">
                  {activeTab === "profile" && (
                    <ProfileSettings
                      user={user}
                      name={name}
                      setName={setName}
                      updateProfile={updateProfile}
                      updating={updating}
                      handleSendVerification={handleSendVerification}
                      sendingVerification={sendingVerification}
                    />
                  )}
                  {activeTab === "storage" && (
                    <StorageSettings
                      storageInfo={storageInfo}
                      updating={updating}
                    />
                  )}
                  {activeTab === "security" && (
                    <SecuritySettings
                      user={user}
                      currentPassword={currentPassword}
                      setCurrentPassword={setCurrentPassword}
                      newPassword={newPassword}
                      setNewPassword={setNewPassword}
                      confirmPassword={confirmPassword}
                      setConfirmPassword={setConfirmPassword}
                      updatePassword={updatePassword}
                      updating={updating}
                      deletePassword={deletePassword}
                      setDeletePassword={setDeletePassword}
                      handleDeleteAccount={handleDeleteAccount}
                      handleRevokeSessions={handleRevokeSessions}
                      sessionUpdating={sessionUpdating}
                      fetchSessions={fetchSessions}
                      sessionLoading={sessionLoading}
                      sessions={sessions}
                      currentSessionId={currentSessionId}
                      handleRevokeSession={handleRevokeSession}
                    />
                  )}
                </div>
              </div>
            </div>

            {/* 확인 모달 */}
        {confirmModal.show && (
          <div className="modal modal-open">
            <div className="modal-box">
              <h3 className="font-bold text-lg">확인</h3>
              <p className="py-4">{confirmModal.message}</p>
              <div className="modal-action">
                <button className="btn" onClick={hideConfirm}>
                  취소
                </button>
                <button className="btn btn-error" onClick={handleConfirm}>
                  확인
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}

// 프로필 설정 컴포넌트
function ProfileSettings({
  user,
  name,
  setName,
  updateProfile,
  updating,
  handleSendVerification,
  sendingVerification,
}) {
  return (
    <div>
      <h2 className="mb-6 text-xl font-semibold">프로필 설정</h2>

      <div className="space-y-6">
        <form onSubmit={updateProfile} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-base-content/70">
              이름
            </label>
            <input
              type="text"
              placeholder="이름을 입력하세요"
              className="input-field"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={updating}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-base-content/70">
              이메일
            </label>
            <input
              type="email"
              className="input-field opacity-60"
              value={user?.email || ""}
              disabled
            />
            <p className="mt-1 text-xs text-base-content/40">
              이메일은 변경할 수 없습니다
            </p>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-base-content/70">
              계정 상태
            </label>
            <div className="flex items-center gap-2">
              <span
                className={
                  user?.isVerified ? "badge-success" : "badge-warning"
                }
              >
                {user?.isVerified ? "인증됨" : "미인증"}
              </span>
              {!user?.isVerified && (
                <button
                  type="button"
                  className="btn-ghost-sm"
                  onClick={handleSendVerification}
                  disabled={sendingVerification}
                >
                  {sendingVerification ? "전송 중..." : "인증 메일 재전송"}
                </button>
              )}
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className={`btn-brand ${updating ? "loading" : ""}`}
              disabled={updating}
            >
              {updating ? "저장 중..." : "저장"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// 저장소 설정 컴포넌트
function StorageSettings({ storageInfo, updating }) {
  const formatBytes = (bytes) => {
    // Handle null, undefined, or other falsy values
    if (!bytes || bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">저장소 관리</h2>

      <div className="space-y-6">
        <StorageInfo
          usedStorage={storageInfo.used}
          totalStorage={storageInfo.total}
          availableStorage={storageInfo.available}
          percentage={storageInfo.percentage}
        />
      </div>
    </div>
  );
}

// 보안 설정 컴포넌트
function SecuritySettings({
  user,
  currentPassword,
  setCurrentPassword,
  newPassword,
  setNewPassword,
  confirmPassword,
  setConfirmPassword,
  updatePassword,
  updating,
  deletePassword,
  setDeletePassword,
  handleDeleteAccount,
  handleRevokeSessions,
  sessionUpdating,
  fetchSessions,
  sessionLoading,
  sessions,
  currentSessionId,
  handleRevokeSession,
}) {
  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">보안 설정</h2>

      <div className="space-y-6">
        {/* 비밀번호 변경 */}
        <div className="card bg-base-200">
          <div className="card-body">
            <h3 className="card-title">비밀번호 변경</h3>
            <form onSubmit={updatePassword} className="space-y-4">
              <div className="form-control">
                <label className="label">
                  <span className="label-text">현재 비밀번호</span>
                </label>
                <input
                  type="password"
                  className="input input-bordered"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  disabled={updating}
                  required
                />
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text">새 비밀번호</span>
                </label>
                <input
                  type="password"
                  className="input input-bordered"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={updating}
                  required
                />
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text">새 비밀번호 확인</span>
                </label>
                <input
                  type="password"
                  className="input input-bordered"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={updating}
                  required
                />
              </div>

              <div className="card-actions justify-end">
                <button
                  type="submit"
                  className={`btn btn-primary ${updating ? "loading" : ""}`}
                  disabled={updating}
                >
                  {updating ? "변경 중..." : "비밀번호 변경"}
                </button>
              </div>
            </form>
          </div>
        </div>
        {/* 2FA 설정 */}
        <TwoFactorSetup />
        {/* 세션 관리 */}
        <div className="card bg-base-200">
          <div className="card-body">
            <h3 className="card-title">세션 관리</h3>
            <p className="text-sm text-gray-500">
              다른 기기에서 로그인된 세션을 강제로 로그아웃할 수 있습니다.
            </p>

            <div className="overflow-x-auto">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>기기</th>
                    <th>IP</th>
                    <th>최근 사용</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {sessionLoading && (
                    <tr>
                      <td colSpan={4}>세션을 불러오는 중...</td>
                    </tr>
                  )}
                  {!sessionLoading && sessions.length === 0 && (
                    <tr>
                      <td colSpan={4}>활성 세션이 없습니다.</td>
                    </tr>
                  )}
                  {!sessionLoading &&
                    sessions.map((session) => {
                      const isCurrent = session.jti === currentSessionId;
                      return (
                        <tr key={session.jti}>
                          <td>
                            <div className="flex flex-col">
                              <span>{session.userAgent || "Unknown"}</span>
                              {isCurrent && (
                                <span className="badge badge-success badge-sm w-fit">
                                  현재 세션
                                </span>
                              )}
                            </div>
                          </td>
                          <td>{session.ip || "Unknown"}</td>
                          <td>
                            {session.lastUsedAt
                              ? new Date(session.lastUsedAt).toLocaleString()
                              : "-"}
                          </td>
                          <td className="text-right">
                            <button
                              className="btn btn-xs btn-outline whitespace-nowrap"
                              onClick={() => handleRevokeSession(session.jti)}
                              disabled={sessionUpdating}
                            >
                              로그아웃
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                className={`btn btn-outline ${sessionUpdating ? "loading" : ""}`}
                onClick={() => handleRevokeSessions("others")}
                disabled={sessionUpdating}
              >
                다른 기기 로그아웃
              </button>
              <button
                className={`btn btn-error ${sessionUpdating ? "loading" : ""}`}
                onClick={() => handleRevokeSessions("all")}
                disabled={sessionUpdating}
              >
                모든 세션 로그아웃
              </button>
            </div>
          </div>
        </div>
        {/* 계정 삭제 */}
        <div className="card bg-error text-error-content">
          <div className="card-body">
            <h3 className="card-title">계정 삭제</h3>
            <p className="text-sm mb-4">
              계정을 삭제하면 모든 데이터가 영구적으로 삭제됩니다. 이 작업은
              되돌릴 수 없습니다.
            </p>

            <div className="form-control mb-4">
              <label className="label">
                <span className="label-text text-error-content">
                  비밀번호 확인
                </span>
              </label>
              <input
                type="password"
                placeholder="현재 비밀번호를 입력하세요"
                className="input input-bordered bg-error-content text-error"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                disabled={updating}
              />
            </div>

            <div className="card-actions justify-end">
              <button
                className="btn btn-outline border-error-content text-error-content hover:bg-error-content hover:text-error"
                onClick={handleDeleteAccount}
                disabled={updating || !deletePassword}
              >
                {updating ? "삭제 중..." : "계정 삭제"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
