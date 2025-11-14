"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import FileUploader from "../components/fileUploader";
import FileList from "../components/fileList";
import CreateDirectory from "../components/createDirectory";

import StorageInfo from "../components/storageInfo";
import SharedItemsPreview from "../components/sharedItemsPreview";
import { useAuth } from "@/context/AuthContext";
import { getStorageInfo } from "@/actions/user";

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

  // 스토리지 정보 조회 함수 메모이제이션
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

  // 업로드 완료 핸들러 메모이제이션
  const handleUploadComplete = useCallback(() => {
    setRefreshTrigger((prev) => prev + 1);
  }, []);

  // 디렉토리 생성 핸들러 메모이제이션
  const handleDirectoryCreated = useCallback(() => {
    setRefreshTrigger((prev) => prev + 1);
  }, []);

  useEffect(() => {
    // 인증 상태가 로딩 중이면 기다림
    if (authLoading) return;

    // 로그인되었지만 user 정보가 없거나 불완전한 경우 새로고침
    if (
      isAuthenticated &&
      !userRefreshed &&
      (!user || user.isVerified === undefined)
    ) {
      const refreshUserInfo = async () => {
        await refreshUser();
        setUserRefreshed(true);
      };
      refreshUserInfo();
      return;
    }

    // 로그인되지 않았다면 로그인 페이지로 이동
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
        <div className="loading loading-spinner loading-lg"></div>
      </main>
    );
  }

  return (
    <>
      <main className="flex min-h-screen flex-col p-6 sm:p-8 md:p-10">
        <h1 className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-6">
          스토리지
        </h1>

        <StorageInfo
          usedStorage={storageInfo.used}
          totalStorage={storageInfo.total}
          availableStorage={storageInfo.available}
          percentage={storageInfo.percentage}
        />

        {/* 이메일 인증 확인 */}
        {!user?.isVerified ? (
          <div className="alert alert-warning mb-6 sm:mb-8 text-sm sm:text-base">
            <div>
              <strong>이메일 인증이 필요합니다!</strong>
              <br />
              파일 업로드를 위해서는 이메일 인증을 완료해주세요.
              <br />
              <small className="text-gray-600 text-xs sm:text-sm">
                가입 시 보내드린 이메일을 확인하거나 프로필에서 다시 인증 메일을
                요청할 수 있습니다.
              </small>
            </div>
          </div>
        ) : (
          <div className="mb-8">
            <FileUploader onUploadComplete={handleUploadComplete} />
          </div>
        )}

        {/* 메인 콘텐츠 영역 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* 파일 목록 (왼쪽, 넓은 영역) */}
          <div className="lg:col-span-2">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <h2 className="text-xl font-semibold">내 파일</h2>
              <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
                <button
                  onClick={() => router.push("/my-uploads")}
                  className="btn btn-outline gap-2 btn-sm sm:btn-md"
                >
                  📂 <span className="hidden sm:inline">모든 파일 보기</span>
                  <span className="sm:hidden">모든 파일</span>
                </button>
                <CreateDirectory onSuccess={handleDirectoryCreated} />
              </div>
            </div>
            <FileList refreshTrigger={refreshTrigger} />
          </div>

          {/* 공유받은 항목 (오른쪽, 좁은 영역) */}
          <div className="lg:col-span-1">
            <SharedItemsPreview />
          </div>
        </div>
      </main>
    </>
  );
}
