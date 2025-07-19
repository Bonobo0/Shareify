"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Navbar from "../components/navbar";
import StorageInfo from "../components/storageInfo";
import { useAuth } from "@/context/AuthContext";

export default function ProfilePage() {
  const router = useRouter();
  const { user, loading: authLoading, isAuthenticated, logout } = useAuth();

  const [name, setName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [storageInfo, setStorageInfo] = useState({ used: 0, total: 0 });

  useEffect(() => {
    if (authLoading) return;

    if (!isAuthenticated) {
      router.push("/user/signin");
      return;
    }

    if (user) {
      setName(user.name || "");
    }

    fetchUserProfile();
  }, [user, isAuthenticated, authLoading, router]);

  const fetchUserProfile = async () => {
    try {
      const response = await fetch("/api/user/profile", {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();

        setName(data.user.name || "");

        setStorageInfo({
          used: data.user.usedStorage || 0,
          total: data.user.quota || 50 * 1024 * 1024 * 1024,
        });
      }
    } catch (error) {
      console.error("프로필 정보 불러오기 실패:", error);
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
      const response = await fetch("/api/user/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          name,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "프로필 업데이트 중 오류가 발생했습니다."
        );
      }

      setSuccess("프로필이 업데이트되었습니다.");
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
      setError("비밀번호는 최소 6자 이상이어야 합니다.");
      return;
    }

    setUpdating(true);

    try {
      const response = await fetch("/api/user/password", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "비밀번호 변경 중 오류가 발생했습니다.");
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSuccess("비밀번호가 성공적으로 변경되었습니다.");
    } catch (error) {
      setError(error.message);
    } finally {
      setUpdating(false);
    }
  };

  if (authLoading || loading) {
    return (
      <>
        <Navbar />
        <main className="flex min-h-screen flex-col items-center justify-center pt-20">
          <div className="loading loading-spinner loading-lg"></div>
        </main>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <main className="flex min-h-screen flex-col p-4 md:p-8 pt-20">
        <h1 className="text-3xl font-bold mb-6">내 프로필</h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <StorageInfo
              usedStorage={storageInfo.used}
              totalStorage={storageInfo.total}
            />

            <div className="card bg-base-200 p-6">
              <h2 className="text-xl font-bold mb-4">계정 정보</h2>

              {error && <div className="alert alert-error mb-4">{error}</div>}
              {success && (
                <div className="alert alert-success mb-4">{success}</div>
              )}

              <form onSubmit={updateProfile}>
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
                  <p className="text-sm text-gray-500 mt-1">
                    이메일은 변경할 수 없습니다.
                  </p>
                </div>

                <div className="form-control mt-4">
                  <label className="label">
                    <span className="label-text">이름</span>
                  </label>
                  <input
                    type="text"
                    className="input input-bordered"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={updating}
                  />
                </div>

                <div className="form-control mt-6">
                  <button
                    type="submit"
                    className={`btn btn-primary ${updating ? "loading" : ""}`}
                    disabled={updating}
                  >
                    정보 업데이트
                  </button>
                </div>
              </form>
            </div>
          </div>

          <div>
            <div className="card bg-base-200 p-6">
              <h2 className="text-xl font-bold mb-4">비밀번호 변경</h2>

              <form onSubmit={updatePassword}>
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

                <div className="form-control mt-4">
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
                    minLength={6}
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    비밀번호는 최소 6자 이상이어야 합니다.
                  </p>
                </div>

                <div className="form-control mt-4">
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

                <div className="form-control mt-6">
                  <button
                    type="submit"
                    className={`btn btn-primary ${updating ? "loading" : ""}`}
                    disabled={
                      updating ||
                      !currentPassword ||
                      !newPassword ||
                      !confirmPassword
                    }
                  >
                    비밀번호 변경
                  </button>
                </div>
              </form>
            </div>

            <div className="card bg-base-200 p-6 mt-6">
              <h2 className="text-xl font-bold mb-4">계정 보안</h2>

              <div className="form-control">
                <label className="label cursor-pointer">
                  <span className="label-text">2단계 인증 사용</span>
                  <input
                    type="checkbox"
                    className="toggle toggle-primary"
                    disabled
                  />
                </label>
                <p className="text-sm text-gray-500 mt-1">
                  곧 제공될 예정입니다.
                </p>
              </div>

              <div className="mt-6">
                <button
                  className="btn btn-outline btn-error"
                  onClick={() => {
                    if (confirm("정말 로그아웃 하시겠습니까?")) {
                      logout();
                    }
                  }}
                >
                  로그아웃
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
