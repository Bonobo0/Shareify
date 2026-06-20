"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import FileUploader from "../components/fileUploader";
import FileList from "../components/fileList";
import CreateDirectory from "../components/createDirectory";
import StorageInfo from "../components/storageInfo";
import SharedItemsPreview from "../components/sharedItemsPreview";
import { useAuth } from "@/context/AuthContext";
import { getStorageInfo } from "@/actions/user";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFolderOpen } from "@fortawesome/free-solid-svg-icons";

export default function Dashboard() {
  const router = useRouter();
  const {
    user,
    loading: authLoading,
    isAuthenticated,
    refreshUser,
  } = useAuth();
  const [loading, setLoading] = useState(true);
  const [storageInfo, setStorageInfo] = useState({ used: 0, total: 0 });
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [userRefreshed, setUserRefreshed] = useState(false);

  const fetchStorageInfo = useCallback(async () => {
    try {
      const result = await getStorageInfo();
      if (result.success) {
        setStorageInfo({
          used: result.usedStorage || 0,
          total: result.quota || 5 * 1024 * 1024 * 1024,
          available: result.availableStorage || 0,
          percentage: result.usagePercentage || 0,
        });
      } else {
        console.error("스토리지 정보 조회 실패:", result.error);
      }
      setLoading(false);
    } catch (error) {
      console.error("스토리지 정보 가져오기 실패:", error);
      setLoading(false);
    }
  }, []);

  const handleUploadComplete = useCallback(() => {
    setRefreshTrigger((prev) => prev + 1);
  }, []);

  const handleDirectoryCreated = useCallback(() => {
    setRefreshTrigger((prev) => prev + 1);
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (isAuthenticated && !userRefreshed && (!user || user.isVerified === undefined)) {
      const refreshUserInfo = async () => {
        await refreshUser();
        setUserRefreshed(true);
      };
      refreshUserInfo();
      return;
    }
    if (!isAuthenticated) {
      router.push("/user/signin");
      return;
    }
    fetchStorageInfo();
  }, [
    isAuthenticated,
    authLoading,
    router,
    refreshTrigger,
    user,
    userRefreshed,
    refreshUser,
    fetchStorageInfo,
  ]);

  if (authLoading || loading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center">
        <div className="loading loading-spinner loading-lg text-brand-500"></div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Page header */}
      <div className="mb-8">
        <h1 className="section-title">대시보드</h1>
        <p className="section-subtitle mt-1">
          {user?.name || user?.email}님, 환영합니다
        </p>
      </div>

      {/* Storage */}
      <div className="mb-8">
        <StorageInfo
          usedStorage={storageInfo.used}
          totalStorage={storageInfo.total}
          availableStorage={storageInfo.available}
          percentage={storageInfo.percentage}
        />
      </div>

      {/* Email verification warning */}
      {!user?.isVerified && (
        <div className="mb-6 rounded-xl border border-warning/30 bg-warning/10 p-4">
          <p className="text-sm font-medium text-warning">
            이메일 인증이 필요합니다
          </p>
          <p className="mt-1 text-xs text-base-content/50">
            파일 업로드를 위해서는 이메일 인증을 완료해주세요. 가입 시 보내드린
            이메일을 확인하거나 프로필에서 다시 인증 메일을 요청할 수 있습니다.
          </p>
        </div>
      )}

      {/* Uploader */}
      {user?.isVerified && (
        <div className="mb-8">
          <FileUploader onUploadComplete={handleUploadComplete} />
        </div>
      )}

      {/* Main content */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* File list */}
        <div className="lg:col-span-2">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold">내 파일</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => router.push("/my-uploads")}
                className="btn-ghost-sm"
              >
                <FontAwesomeIcon icon={faFolderOpen} />
                <span className="hidden sm:inline">모든 파일 보기</span>
                <span className="sm:hidden">모든 파일</span>
              </button>
              <CreateDirectory onSuccess={handleDirectoryCreated} />
            </div>
          </div>
          <FileList refreshTrigger={refreshTrigger} />
        </div>

        {/* Shared items */}
        <div className="lg:col-span-1">
          <SharedItemsPreview />
        </div>
      </div>
    </main>
  );
}
