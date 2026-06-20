"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { getSharedItems } from "@/actions/share";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faImage,
  faFilm,
  faMusic,
  faFile,
  faFileLines,
  faChartBar,
  faFileZipper,
  faFolder,
  faUpload,
} from "@fortawesome/free-solid-svg-icons";

export default function SharedPage() {
  const router = useRouter();
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const [sharedFiles, setSharedFiles] = useState([]);
  const [sharedDirectories, setSharedDirectories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      router.push("/user/signin");
      return;
    }
    fetchSharedItems();
  }, [isAuthenticated, authLoading, router]);

  const fetchSharedItems = async () => {
    try {
      const result = await getSharedItems();
      if (result.error) throw new Error(result.error);
      setSharedFiles(result.files || []);
      setSharedDirectories(result.directories || []);
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const formatBytes = (bytes, decimals = 2) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString("ko-KR");
  };

  const navigateToFile = (hash) => {
    window.open(`/file/${hash}`, "_blank");
  };

  const navigateToDirectory = (directoryId) => {
    router.push(`/directory/${directoryId}`);
  };

  const getFileTypeIcon = (mimetype) => {
    if (mimetype?.includes("image"))
      return <FontAwesomeIcon icon={faImage} />;
    if (mimetype?.includes("video"))
      return <FontAwesomeIcon icon={faFilm} />;
    if (mimetype?.includes("audio"))
      return <FontAwesomeIcon icon={faMusic} />;
    if (mimetype?.includes("pdf")) return <FontAwesomeIcon icon={faFile} />;
    if (mimetype?.includes("word") || mimetype?.includes("document"))
      return <FontAwesomeIcon icon={faFileLines} />;
    if (mimetype?.includes("spreadsheet") || mimetype?.includes("excel"))
      return <FontAwesomeIcon icon={faChartBar} />;
    if (mimetype?.includes("zip") || mimetype?.includes("compressed"))
      return <FontAwesomeIcon icon={faFileZipper} />;
    return <FontAwesomeIcon icon={faFile} />;
  };

  if (authLoading || loading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center">
        <div className="loading loading-spinner loading-lg text-brand-500"></div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="section-title">공유된 항목</h1>
        <p className="section-subtitle mt-1">
          다른 사용자와 공유된 파일과 디렉토리입니다
        </p>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-error/30 bg-error/10 px-4 py-3 text-sm text-error">
          {error}
        </div>
      )}

      {/* Shared directories */}
      {sharedDirectories.length > 0 && (
        <div className="mb-8">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
            <FontAwesomeIcon icon={faFolder} className="text-brand-400" />
            공유된 디렉토리
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sharedDirectories.map((directory) => (
              <div
                key={directory.id}
                className="card-surface cursor-pointer p-4"
                onClick={() => navigateToDirectory(directory.hash)}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl text-brand-400">
                    <FontAwesomeIcon icon={faFolder} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-medium">{directory.name}</h3>
                    <p className="text-sm text-base-content/50">
                      {directory.ownerName}님이 공유
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <span
                        className={`badge-neutral text-xs ${
                          directory.permission === "admin"
                            ? "badge-brand"
                            : directory.permission === "write"
                              ? "badge-warning"
                              : ""
                        }`}
                      >
                        {directory.permission === "admin"
                          ? "관리자"
                          : directory.permission === "write"
                            ? "편집"
                            : "읽기"}
                      </span>
                      <span className="text-xs text-base-content/40">
                        {formatDate(directory.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Shared files */}
      <div>
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
          <FontAwesomeIcon icon={faFile} className="text-brand-400" />
          공유된 파일
        </h2>
        {sharedFiles.length === 0 ? (
          <div className="rounded-xl border border-surface-300/30 bg-surface-50/50 p-8 text-center">
            <p className="text-base-content/40">공유된 파일이 없습니다.</p>
          </div>
        ) : (
          <div className="table-surface overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th>이름</th>
                  <th className="hidden sm:table-cell">크기</th>
                  <th className="hidden md:table-cell">유형</th>
                  <th className="hidden lg:table-cell">공유자</th>
                  <th className="hidden sm:table-cell">날짜</th>
                  <th>권한</th>
                </tr>
              </thead>
              <tbody>
                {sharedFiles.map((file) => (
                  <tr
                    key={file.id}
                    className="cursor-pointer"
                    onClick={() => navigateToFile(file.hash)}
                  >
                    <td>
                      <div className="flex items-center gap-2">
                        <span className="text-lg text-brand-400">
                          {getFileTypeIcon(file.mimetype)}
                        </span>
                        <span className="truncate">{file.originalName}</span>
                      </div>
                    </td>
                    <td className="hidden sm:table-cell text-base-content/60">
                      {formatBytes(file.size)}
                    </td>
                    <td className="hidden md:table-cell text-base-content/60">
                      {file.mimetype?.split("/")[1] || file.mimetype}
                    </td>
                    <td className="hidden lg:table-cell text-base-content/60">
                      {file.ownerName || "Unknown"}
                    </td>
                    <td className="hidden sm:table-cell text-base-content/60">
                      {formatDate(file.createdAt)}
                    </td>
                    <td>
                      <span
                        className={`badge-neutral text-xs ${
                          file.permission === "admin"
                            ? "badge-brand"
                            : file.permission === "write"
                              ? "badge-warning"
                              : ""
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

      {/* Empty state */}
      {sharedFiles.length === 0 && sharedDirectories.length === 0 && (
        <div className="mt-8 rounded-xl border border-surface-300/30 bg-surface-50/50 p-12 text-center">
          <FontAwesomeIcon
            icon={faUpload}
            className="mb-4 text-4xl text-base-content/15"
          />
          <h3 className="mb-2 text-lg font-semibold">공유된 항목이 없습니다</h3>
          <p className="mb-4 text-sm text-base-content/40">
            다른 사용자가 파일이나 디렉토리를 공유하면 여기에 표시됩니다.
          </p>
          <Link href="/dashboard" className="btn-brand">
            대시보드로 돌아가기
          </Link>
        </div>
      )}
    </main>
  );
}
