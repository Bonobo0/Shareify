"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Navbar from "@/app/components/navbar";
import { useAuth } from "@/context/AuthContext";

export default function SharePage() {
  const params = useParams();
  const { hash } = params;
  const { user } = useAuth();

  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (hash) {
      fetchSharedFile();
    }
  }, [hash]);

  const fetchSharedFile = async () => {
    try {
      const response = await fetch(`/api/share/${hash}`, {
        credentials: "include",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "파일 정보를 불러오는 중 오류가 발생했습니다."
        );
      }

      setFile(data.file);
    } catch (error) {
      setError(error.message || "파일을 찾을 수 없습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    try {
      const response = await fetch(`/api/share/download/${hash}`, {
        credentials: "include",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "다운로드 URL을 생성하는 중 오류가 발생했습니다."
        );
      }

      window.open(data.downloadUrl, "_blank");
    } catch (error) {
      alert(error.message);
    }
  };

  const formatBytes = (bytes, decimals = 2) => {
    if (!bytes) return "0 Bytes";

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
  };

  if (loading) {
    return (
      <>
        <Navbar />
        <main className="flex min-h-screen flex-col items-center justify-center pt-20">
          <div className="loading loading-spinner loading-lg"></div>
        </main>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Navbar />
        <main className="flex min-h-screen flex-col items-center p-8 pt-20">
          <div className="alert alert-error max-w-md">{error}</div>
          <p className="mt-4">
            이 파일은 존재하지 않거나, 접근 권한이 없거나, 공개 상태가
            변경되었을 수 있습니다.
          </p>

          {!user && (
            <div className="mt-6">
              <p>계정이 있으신가요?</p>
              <Link href="/user/signin" className="btn btn-primary mt-2">
                로그인
              </Link>
            </div>
          )}
        </main>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <main className="flex min-h-screen flex-col items-center p-4 md:p-8 pt-20">
        <div className="card bg-base-200 p-6 max-w-xl w-full">
          <h1 className="text-3xl font-bold mb-6 text-center">공유된 파일</h1>

          <div className="text-center mb-8">
            <div className="text-5xl mb-4">
              {file?.mimetype?.includes("image")
                ? "🖼️"
                : file?.mimetype?.includes("pdf")
                ? "📄"
                : file?.mimetype?.includes("video")
                ? "🎬"
                : file?.mimetype?.includes("audio")
                ? "🎵"
                : "📁"}
            </div>

            <h2 className="text-xl font-semibold">{file?.originalName}</h2>
            <p className="text-gray-500 mt-2">{formatBytes(file?.size)}</p>
          </div>

          <div className="flex justify-center">
            <button className="btn btn-primary btn-lg" onClick={handleDownload}>
              다운로드
            </button>
          </div>

          {!user && (
            <div className="text-center mt-8 pt-4 border-t">
              <p>더 많은 파일을 공유하고 관리하세요</p>
              <div className="flex justify-center gap-2 mt-2">
                <Link href="/user/signin" className="btn">
                  로그인
                </Link>
                <Link href="/user/signup" className="btn btn-outline">
                  회원가입
                </Link>
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
