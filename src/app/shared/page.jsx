"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Navbar from "../components/navbar";
import { useAuth } from "@/context/AuthContext";

export default function SharedPage() {
  const router = useRouter();
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const [sharedFiles, setSharedFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    // 인증 상태가 로딩 중이면 기다림
    if (authLoading) return;

    // 로그인되지 않았다면 로그인 페이지로 이동
    if (!isAuthenticated) {
      router.push("/user/signin");
      return;
    }

    fetchSharedFiles();
  }, [isAuthenticated, authLoading, router]);

  const fetchSharedFiles = async () => {
    try {
      const response = await fetch("/api/files/shared", {
        credentials: "include", // 쿠키 포함
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(
          data.error || "공유 파일 목록을 불러오는 중 오류가 발생했습니다."
        );
      }

      const data = await response.json();
      setSharedFiles(data.files || []);
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const formatBytes = (bytes, decimals = 2) => {
    if (bytes === 0) return "0 Bytes";

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const navigateToFile = (hash) => {
    router.push(`/file/${hash}`);
  };

  const getFileTypeIcon = (mimetype) => {
    if (mimetype?.includes("image")) return "🖼️";
    if (mimetype?.includes("video")) return "🎬";
    if (mimetype?.includes("audio")) return "🎵";
    if (mimetype?.includes("pdf")) return "📄";
    if (mimetype?.includes("word") || mimetype?.includes("document"))
      return "📝";
    if (mimetype?.includes("spreadsheet") || mimetype?.includes("excel"))
      return "📊";
    if (mimetype?.includes("presentation") || mimetype?.includes("powerpoint"))
      return "📽️";
    if (mimetype?.includes("zip") || mimetype?.includes("compressed"))
      return "🗜️";
    return "📄";
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
        <h1 className="text-3xl font-bold mb-6">나와 공유된 파일</h1>

        {error && <div className="alert alert-error mb-6">{error}</div>}

        {sharedFiles.length === 0 ? (
          <div className="text-center p-6 bg-base-200 rounded-lg">
            <p>공유된 파일이 없습니다.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table w-full">
              <thead>
                <tr>
                  <th>이름</th>
                  <th>크기</th>
                  <th>유형</th>
                  <th>공유자</th>
                  <th>날짜</th>
                  <th>권한</th>
                </tr>
              </thead>
              <tbody>
                {sharedFiles.map((file) => (
                  <tr
                    key={file.id}
                    className="hover cursor-pointer"
                    onClick={() => navigateToFile(file.hash)}
                  >
                    <td className="flex items-center gap-2">
                      <span className="text-xl">
                        {getFileTypeIcon(file.mimetype)}
                      </span>
                      {file.originalName}
                    </td>
                    <td>{formatBytes(file.size)}</td>
                    <td>{file.mimetype?.split("/")[1] || file.mimetype}</td>
                    <td>{file.ownerName || "Unknown"}</td>
                    <td>{formatDate(file.createdAt)}</td>
                    <td>
                      <span
                        className={`badge ${
                          file.permission === "admin"
                            ? "badge-primary"
                            : file.permission === "write"
                            ? "badge-secondary"
                            : "badge-ghost"
                        }`}
                      >
                        {file.permission === "admin"
                          ? "관리자"
                          : file.permission === "write"
                          ? "편집"
                          : "읽기"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </>
  );
}
