"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import FileList from "../components/fileList";
import { useAuth } from "@/context/AuthContext";

export default function MyUploadsPage() {
  const router = useRouter();
  const { user, loading: authLoading, isAuthenticated } = useAuth();

  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    if (authLoading) return;

    if (!isAuthenticated) {
      router.push("/user/signin");
      return;
    }
  }, [isAuthenticated, authLoading, router]);

  if (authLoading) {
    return (
      <>
        <main className="flex min-h-screen flex-col items-center justify-center">
          <div className="loading loading-spinner loading-lg"></div>
        </main>
      </>
    );
  }

  return (
    <>
      <main className="flex min-h-screen flex-col p-2 sm:p-4 md:p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">내가 업로드한 파일들</h1>
            <p className="text-gray-600 mt-2">
              업로드한 모든 파일을 확인할 수 있습니다.
            </p>
          </div>

          <button onClick={() => router.back()} className="btn btn-outline">
            ← 뒤로가기
          </button>
        </div>

        <FileList
          mode="my-uploads"
          showDirectories={false}
          refreshTrigger={refreshTrigger}
        />
      </main>
    </>
  );
}
