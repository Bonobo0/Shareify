"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "../components/navbar";
import { useAuth } from "@/context/AuthContext";
import { getSharedItems } from "@/actions/share";

export default function SharedPage() {
  const router = useRouter();
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const [sharedFiles, setSharedFiles] = useState([]);
  const [sharedDirectories, setSharedDirectories] = useState([]);
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

    fetchSharedItems();
  }, [isAuthenticated, authLoading, router]);

  const fetchSharedItems = async () => {
    try {
      const result = await getSharedItems();

      if (result.error) {
        throw new Error(result.error);
      }

      setSharedFiles(result.files || []);
      setSharedDirectories(result.directories || []);
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
    window.open(`/file/${hash}`, "_blank");
  };

  const navigateToDirectory = (directoryId) => {
    router.push(`/directory/${directoryId}`);
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
        <h1 className="text-3xl font-bold mb-6">나와 공유된 항목</h1>

        {error && <div className="alert alert-error mb-6">{error}</div>}

        {/* 공유된 디렉토리 섹션 */}
        {sharedDirectories.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">📁 공유된 디렉토리</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sharedDirectories.map((directory) => (
                <div
                  key={directory.id}
                  className="card bg-base-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => navigateToDirectory(directory.hash)}
                >
                  <div className="card-body p-4">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">📁</span>
                      <div className="flex-1">
                        <h3 className="font-medium">{directory.name}</h3>
                        <p className="text-sm text-gray-600">
                          {directory.ownerName}님이 공유
                        </p>
                        <div className="flex gap-2 mt-2">
                          <span
                            className={`badge badge-sm ${
                              directory.permission === "admin"
                                ? "badge-primary"
                                : directory.permission === "write"
                                ? "badge-secondary"
                                : "badge-ghost"
                            }`}
                          >
                            {directory.permission === "admin"
                              ? "관리자"
                              : directory.permission === "write"
                              ? "편집"
                              : "읽기"}
                          </span>
                          <span className="text-xs text-gray-500">
                            {formatDate(directory.sharedAt)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 공유된 파일 섹션 */}
        <div>
          <h2 className="text-2xl font-semibold mb-4">📄 공유된 파일</h2>
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
        </div>

        {/* 공유된 항목이 없는 경우 */}
        {sharedFiles.length === 0 && sharedDirectories.length === 0 && (
          <div className="text-center p-12 bg-base-200 rounded-lg">
            <div className="text-6xl mb-4">📤</div>
            <h3 className="text-xl font-semibold mb-2">
              공유된 항목이 없습니다
            </h3>
            <p className="text-gray-600 mb-4">
              다른 사용자가 파일이나 디렉토리를 공유하면 여기에 표시됩니다.
            </p>
            <Link href="/dashboard" className="btn btn-primary">
              대시보드로 돌아가기
            </Link>
          </div>
        )}
      </main>
    </>
  );
}
