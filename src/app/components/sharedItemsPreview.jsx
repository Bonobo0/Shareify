"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getSharedItems } from "@/actions/share";

export default function SharedItemsPreview() {
  const [sharedFiles, setSharedFiles] = useState([]);
  const [sharedDirectories, setSharedDirectories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchSharedItems();
  }, []);

  const fetchSharedItems = async () => {
    try {
      const result = await getSharedItems();

      if (result.error) {
        throw new Error(result.error);
      }

      // 최신 5개 항목만 표시
      setSharedFiles((result.files || []).slice(0, 5));
      setSharedDirectories((result.directories || []).slice(0, 5));
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const formatBytes = (bytes, decimals = 2) => {
    if (bytes === 0) return "0 Bytes";

    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return (
      parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + " " + sizes[i]
    );
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("ko-KR", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getFileIcon = (mimetype) => {
    if (mimetype?.startsWith("image/")) return "🖼️";
    if (mimetype?.startsWith("video/")) return "🎥";
    if (mimetype?.startsWith("audio/")) return "🎵";
    if (mimetype?.includes("pdf")) return "📄";
    if (mimetype?.includes("document")) return "📝";
    if (mimetype?.includes("spreadsheet")) return "📊";
    return "📄";
  };

  if (loading) {
    return (
      <div className="card bg-base-200 p-6">
        <h2 className="text-xl font-bold mb-4">공유받은 항목</h2>
        <div className="flex justify-center">
          <div className="loading loading-spinner"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card bg-base-200 p-6">
        <h2 className="text-xl font-bold mb-4">공유받은 항목</h2>
        <div className="alert alert-error">
          <span>{error}</span>
        </div>
      </div>
    );
  }

  const totalItems = sharedFiles.length + sharedDirectories.length;

  return (
    <div className="card bg-base-200 p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">공유받은 항목</h2>
        <Link href="/shared" className="btn btn-sm btn-primary">
          전체 보기
        </Link>
      </div>

      {totalItems === 0 ? (
        <div className="text-center py-8">
          <div className="text-4xl mb-2">📤</div>
          <p className="text-gray-600">공유받은 항목이 없습니다.</p>
          <Link href="/shared" className="btn btn-sm btn-outline mt-2">
            공유 페이지로 이동
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {/* 공유받은 디렉토리 */}
          {sharedDirectories.map((directory) => (
            <Link
              key={`dir-${directory.hash}`}
              href={`/directory/${directory.hash}`}
              className="flex items-center justify-between p-3 bg-base-100 rounded-lg hover:bg-base-300 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">📁</span>
                <div>
                  <div className="font-medium">{directory.name}</div>
                  <div className="text-sm text-gray-600">
                    <span className="badge badge-sm mr-2">
                      {directory.permission === "read"
                        ? "읽기"
                        : directory.permission === "write"
                        ? "편집"
                        : "관리"}
                    </span>
                    {directory.ownerName}님이 공유
                  </div>
                </div>
              </div>
              <div className="text-sm text-gray-500">
                {formatDate(directory.createdAt)}
              </div>
            </Link>
          ))}

          {/* 공유받은 파일 */}
          {sharedFiles.map((file) => (
            <Link
              key={`file-${file.id}`}
              href={`/file/${file.hash}`}
              className="flex items-center justify-between p-3 bg-base-100 rounded-lg hover:bg-base-300 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">{getFileIcon(file.mimetype)}</span>
                <div>
                  <div className="font-medium">{file.originalName}</div>
                  <div className="text-sm text-gray-600">
                    <span className="badge badge-sm mr-2">
                      {file.permission === "read"
                        ? "읽기"
                        : file.permission === "write"
                        ? "편집"
                        : "관리"}
                    </span>
                    {file.ownerName}님이 공유 • {formatBytes(file.size)}
                  </div>
                </div>
              </div>
              <div className="text-sm text-gray-500">
                {formatDate(file.createdAt)}
              </div>
            </Link>
          ))}

          {/* 더 많은 항목이 있는 경우 */}
          {totalItems >= 5 && (
            <div className="text-center pt-2">
              <Link href="/shared" className="btn btn-sm btn-ghost">
                더 많은 항목 보기 →
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
