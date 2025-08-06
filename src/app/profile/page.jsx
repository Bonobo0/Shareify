"use client";

import { useState, useEffect } from "react";
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
import { sendEmailVerification } from "@/actions/verification";

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
    { id: "profile", label: "프로필", icon: "👤" },
    { id: "storage", label: "저장소", icon: "💾" },
    { id: "security", label: "보안", icon: "🔒" },
  ];

  return (
    <>
      <main className="flex flex-col p-4 md:p-8">
        <div className="max-w-6xl mx-auto w-full">
          <h1 className="text-3xl font-bold mb-6">프로필 및 설정</h1>

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

          <div className="flex flex-col lg:flex-row gap-6">
            {/* 사이드바 */}
            <div className="lg:w-1/4">
              <div className="card bg-base-200 shadow-xl">
                <div className="card-body p-4">
                  <div className="menu">
                    {tabs.map((tab) => (
                      <li key={tab.id}>
                        <button
                          className={`${activeTab === tab.id ? "active" : ""}`}
                          onClick={() => setActiveTab(tab.id)}
                        >
                          <span className="mr-2">{tab.icon}</span>
                          {tab.label}
                        </button>
                      </li>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* 메인 콘텐츠 */}
            <div className="lg:w-3/4">
              <div className="card bg-base-100 shadow-xl">
                <div className="card-body">
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
                    />
                  )}
                </div>
              </div>
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
      <h2 className="text-2xl font-bold mb-4">프로필 설정</h2>

      <div className="space-y-6">
        <form onSubmit={updateProfile} className="space-y-4">
          <div className="form-control">
            <label className="label">
              <span className="label-text">이름</span>
            </label>
            <input
              type="text"
              placeholder="이름을 입력하세요"
              className="input input-bordered"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={updating}
            />
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text">이메일</span>
            </label>
            <input
              type="email"
              className="input input-bordered"
              value={user?.email || ""}
              disabled
            />
            <label className="label">
              <span className="label-text-alt text-gray-500">
                이메일은 변경할 수 없습니다
              </span>
            </label>
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text">계정 상태</span>
            </label>
            <div className="flex items-center gap-2">
              <div
                className={`badge ${
                  user?.isVerified ? "badge-success" : "badge-warning"
                }`}
              >
                {user?.isVerified ? "인증됨" : "미인증"}
              </div>
              {!user?.isVerified && (
                <button
                  type="button"
                  className="btn btn-sm btn-outline"
                  onClick={handleSendVerification}
                  disabled={sendingVerification}
                >
                  {sendingVerification ? "전송 중..." : "인증 메일 재전송"}
                </button>
              )}
            </div>
          </div>

          <div className="card-actions justify-end">
            <button
              type="submit"
              className={`btn btn-primary ${updating ? "loading" : ""}`}
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
}) {
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
