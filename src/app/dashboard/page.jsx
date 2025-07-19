"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import FileUploader from "../components/fileUploader";
import FileList from "../components/fileList";
import CreateDirectory from "../components/createDirectory";
import Navbar from "../components/navbar";
import StorageInfo from "../components/storageInfo";
import { useAuth } from "@/context/AuthContext";

export default function Dashboard() {
  const router = useRouter();
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(true);
  const [storageInfo, setStorageInfo] = useState({ used: 0, total: 0 });
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    // 인증 상태가 로딩 중이면 기다림
    if (authLoading) return;

    // 로그인되지 않았다면 로그인 페이지로 이동
    if (!isAuthenticated) {
      router.push("/user/signin");
      return;
    }

    fetchStorageInfo();
  }, [isAuthenticated, authLoading, router, refreshTrigger]);

  const fetchStorageInfo = async () => {
    try {
      const response = await fetch("/api/user/storage", {
        credentials: "include", // 쿠키 포함
      });

      if (response.ok) {
        const data = await response.json();
        setStorageInfo({
          used: data.usedStorage || 0,
          total: data.quota || 50 * 1024 * 1024 * 1024,
          available: data.availableStorage || 0,
          percentage: data.usagePercentage || 0,
        });
      }

      setLoading(false);
    } catch (error) {
      console.error("스토리지 정보 가져오기 실패:", error);
      setLoading(false);
    }
  };

  const handleUploadComplete = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  const handleDirectoryCreated = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  if (authLoading || loading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center">
        <div className="loading loading-spinner loading-lg"></div>
      </main>
    );
  }

  return (
    <>
      <Navbar />
      <main className="flex min-h-screen flex-col p-4 md:p-8 pt-20">
        <h1 className="text-3xl font-bold mb-6">내 파일</h1>

        <StorageInfo
          usedStorage={storageInfo.used}
          totalStorage={storageInfo.total}
          availableStorage={storageInfo.available}
          percentage={storageInfo.percentage}
        />

        <div className="flex flex-wrap gap-4 mb-8 mt-4">
          <CreateDirectory onSuccess={handleDirectoryCreated} />
        </div>

        <div className="mb-8">
          <FileUploader onUploadComplete={handleUploadComplete} />
        </div>

        <div>
          <FileList refreshTrigger={refreshTrigger} />
        </div>
      </main>
    </>
  );
}
