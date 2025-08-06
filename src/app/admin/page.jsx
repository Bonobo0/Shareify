"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { getAllUsers, updateUserQuota, updateUserRole, suspendUser } from "@/actions/admin";

export default function AdminPage() {
  const router = useRouter();
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [modalType, setModalType] = useState(""); // 'quota', 'role', 'suspend'
  const [modalData, setModalData] = useState({});

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const result = await getAllUsers();

      if (result.error) {
        throw new Error(result.error);
      }

      setUsers(result.users || []);
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Check if user is admin
  useEffect(() => {
    if (authLoading) return;

    if (!isAuthenticated) {
      router.push("/user/signin");
      return;
    }

    if (user?.role !== "admin") {
      router.push("/dashboard");
      return;
    }

    fetchUsers();
  }, [isAuthenticated, authLoading, user, router, fetchUsers]);

  // Filter users based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredUsers(users);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = users.filter(
        (u) =>
          u.name?.toLowerCase().includes(query) ||
          u.email?.toLowerCase().includes(query)
      );
      setFilteredUsers(filtered);
    }
  }, [searchQuery, users]);

  const formatBytes = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const openQuotaModal = (user) => {
    setSelectedUser(user);
    setModalType("quota");
    setModalData({
      storageLimit: Math.round(user.storageLimit / (1024 * 1024 * 1024)), // Convert to GB
    });
  };

  const openRoleModal = (user) => {
    setSelectedUser(user);
    setModalType("role");
    setModalData({ role: user.role });
  };

  const openSuspendModal = (user) => {
    setSelectedUser(user);
    setModalType("suspend");
    setModalData({});
  };

  const closeModal = () => {
    setSelectedUser(null);
    setModalType("");
    setModalData({});
  };

  const handleQuotaUpdate = async () => {
    try {
      const result = await updateUserQuota({
        userId: selectedUser.id,
        newLimit: modalData.storageLimit * 1024 * 1024 * 1024, // Convert GB to bytes
      });

      if (result.error) {
        throw new Error(result.error);
      }

      closeModal();
      fetchUsers(); // Refresh the list
    } catch (error) {
      alert("할당량 업데이트 실패: " + error.message);
    }
  };

  const handleRoleUpdate = async () => {
    try {
      const result = await updateUserRole({
        userId: selectedUser.id,
        newRole: modalData.role,
      });

      if (result.error) {
        throw new Error(result.error);
      }

      closeModal();
      fetchUsers(); // Refresh the list
    } catch (error) {
      alert("역할 업데이트 실패: " + error.message);
    }
  };

  const handleUserSuspend = async () => {
    try {
      const result = await suspendUser({
        userId: selectedUser.id,
        suspended: !selectedUser.suspended,
      });

      if (result.error) {
        throw new Error(result.error);
      }

      closeModal();
      fetchUsers(); // Refresh the list
    } catch (error) {
      alert("사용자 상태 변경 실패: " + error.message);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center">
        <div className="loading loading-spinner loading-lg"></div>
        <p className="mt-4 text-lg">로딩 중...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center">
        <div className="alert alert-error max-w-md">
          <span>{error}</span>
        </div>
        <Link href="/dashboard" className="btn btn-primary mt-4">
          대시보드로 돌아가기
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">관리자 페이지</h1>
          <p className="text-gray-600 mt-1">사용자 계정 및 할당량 관리</p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/rate-limit" className="btn btn-outline btn-sm">
            Rate Limit 모니터
          </Link>
          <Link href="/dashboard" className="btn btn-ghost btn-sm">
            대시보드로
          </Link>
        </div>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <input
            type="text"
            placeholder="사용자 검색 (이름 또는 이메일)"
            className="input input-bordered w-full pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="stat bg-base-200 rounded-lg">
          <div className="stat-title">총 사용자</div>
          <div className="stat-value text-primary">{users.length}</div>
        </div>
        <div className="stat bg-base-200 rounded-lg">
          <div className="stat-title">관리자</div>
          <div className="stat-value text-secondary">
            {users.filter((u) => u.role === "admin").length}
          </div>
        </div>
        <div className="stat bg-base-200 rounded-lg">
          <div className="stat-title">인증된 사용자</div>
          <div className="stat-value text-accent">
            {users.filter((u) => u.isVerified).length}
          </div>
        </div>
      </div>

      {/* User List */}
      <div className="card bg-base-200 shadow-sm">
        <div className="card-body">
          <h2 className="card-title mb-4">사용자 목록</h2>
          
          {filteredUsers.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-600">
                {searchQuery ? "검색 결과가 없습니다." : "사용자가 없습니다."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table table-zebra w-full">
                <thead>
                  <tr>
                    <th>사용자</th>
                    <th>역할</th>
                    <th>저장소 사용량</th>
                    <th>인증 상태</th>
                    <th>가입일</th>
                    <th>작업</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => (
                    <tr key={user.id}>
                      <td>
                        <div>
                          <div className="font-medium">{user.name || "이름 없음"}</div>
                          <div className="text-sm text-gray-600">{user.email}</div>
                        </div>
                      </td>
                      <td>
                        <div className={`badge ${user.role === "admin" ? "badge-primary" : "badge-ghost"}`}>
                          {user.role === "admin" ? "관리자" : "사용자"}
                        </div>
                      </td>
                      <td>
                        <div>
                          <div className="text-sm">
                            {formatBytes(user.storageUsed)} / {formatBytes(user.storageLimit)}
                          </div>
                          <div className="w-20 bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-primary h-2 rounded-full"
                              style={{
                                width: `${Math.min(
                                  (user.storageUsed / user.storageLimit) * 100,
                                  100
                                )}%`,
                              }}
                            ></div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className={`badge ${user.isVerified ? "badge-success" : "badge-warning"}`}>
                          {user.isVerified ? "인증됨" : "미인증"}
                        </div>
                      </td>
                      <td className="text-sm">{formatDate(user.createdAt)}</td>
                      <td>
                        <div className="flex gap-1">
                          <button
                            onClick={() => openQuotaModal(user)}
                            className="btn btn-xs btn-outline"
                          >
                            할당량
                          </button>
                          <button
                            onClick={() => openRoleModal(user)}
                            className="btn btn-xs btn-outline"
                          >
                            역할
                          </button>
                          <button
                            onClick={() => openSuspendModal(user)}
                            className={`btn btn-xs ${user.suspended ? "btn-warning" : "btn-error"}`}
                          >
                            {user.suspended ? "해제" : "정지"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {modalType === "quota" && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-base-100 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-bold mb-4">저장소 할당량 변경</h3>
            <p className="text-sm text-gray-600 mb-4">
              {selectedUser.name || selectedUser.email}의 저장소 할당량을 변경합니다.
            </p>
            
            <div className="form-control mb-4">
              <label className="label">
                <span className="label-text">할당량 (GB)</span>
              </label>
              <input
                type="number"
                min="1"
                max="1000"
                className="input input-bordered"
                value={modalData.storageLimit}
                onChange={(e) =>
                  setModalData({ ...modalData, storageLimit: parseInt(e.target.value) })
                }
              />
            </div>

            <div className="flex gap-2 justify-end">
              <button className="btn btn-ghost" onClick={closeModal}>
                취소
              </button>
              <button className="btn btn-primary" onClick={handleQuotaUpdate}>
                변경
              </button>
            </div>
          </div>
        </div>
      )}

      {modalType === "role" && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-base-100 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-bold mb-4">사용자 역할 변경</h3>
            <p className="text-sm text-gray-600 mb-4">
              {selectedUser.name || selectedUser.email}의 역할을 변경합니다.
            </p>
            
            <div className="form-control mb-4">
              <label className="label">
                <span className="label-text">역할</span>
              </label>
              <select
                className="select select-bordered"
                value={modalData.role}
                onChange={(e) => setModalData({ ...modalData, role: e.target.value })}
              >
                <option value="user">사용자</option>
                <option value="admin">관리자</option>
              </select>
            </div>

            <div className="flex gap-2 justify-end">
              <button className="btn btn-ghost" onClick={closeModal}>
                취소
              </button>
              <button className="btn btn-primary" onClick={handleRoleUpdate}>
                변경
              </button>
            </div>
          </div>
        </div>
      )}

      {modalType === "suspend" && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-base-100 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-bold mb-4">
              {selectedUser.suspended ? "사용자 활성화" : "사용자 정지"}
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              {selectedUser.name || selectedUser.email}를{" "}
              {selectedUser.suspended ? "활성화" : "정지"}시키시겠습니까?
            </p>

            <div className="flex gap-2 justify-end">
              <button className="btn btn-ghost" onClick={closeModal}>
                취소
              </button>
              <button
                className={`btn ${selectedUser.suspended ? "btn-success" : "btn-error"}`}
                onClick={handleUserSuspend}
              >
                {selectedUser.suspended ? "활성화" : "정지"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}