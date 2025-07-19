"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function FileList({ directoryId = null, refreshTrigger = 0 }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [files, setFiles] = useState([]);
  const [directories, setDirectories] = useState([]);
  const [currentDirectory, setCurrentDirectory] = useState(null);
  const [breadcrumbs, setBreadcrumbs] = useState([]);
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState("desc");

  useEffect(() => {
    fetchData();
  }, [directoryId, refreshTrigger, sortBy, sortOrder]);

  const fetchData = async () => {
    setLoading(true);
    setError("");

    try {
      // API 경로 수정 (앞에 (server-side)가 있다면 제거)
      const fileResponse = await fetch(
        `/api/files/list?directoryId=${
          directoryId || ""
        }&sortBy=${sortBy}&sortOrder=${sortOrder}`,
        {
          credentials: "include",
        }
      );

      if (!fileResponse.ok) {
        const data = await fileResponse.json();
        console.error("파일 목록 API 응답 오류:", data);
        throw new Error(
          data.error || "파일 목록을 불러오는 중 오류가 발생했습니다."
        );
      }

      const fileData = await fileResponse.json();
      console.log("파일 목록 데이터:", fileData);
      setFiles(fileData.files || []);

      // 디렉토리 목록 가져오기
      const dirResponse = await fetch(
        `/api/directories/list?parentId=${directoryId || ""}`,
        {
          credentials: "include",
        }
      );

      if (!dirResponse.ok) {
        const data = await dirResponse.json();
        throw new Error(
          data.error || "디렉토리 목록을 불러오는 중 오류가 발생했습니다."
        );
      }

      const dirData = await dirResponse.json();
      setDirectories(dirData.directories || []);

      // 현재 디렉토리 정보 가져오기 (만약 하위 디렉토리라면)
      if (directoryId) {
        const currentDirResponse = await fetch(
          `/api/directories/${directoryId}`,
          {
            credentials: "include",
          }
        );

        if (currentDirResponse.ok) {
          const currentDirData = await currentDirResponse.json();
          setCurrentDirectory(currentDirData.directory);

          // 경로 정보 가져오기
          if (currentDirData.directory && currentDirData.breadcrumbs) {
            setBreadcrumbs(currentDirData.breadcrumbs);
          }
        }
      } else {
        // 루트 디렉토리인 경우
        setCurrentDirectory(null);
        setBreadcrumbs([]);
      }
    } catch (error) {
      console.error("파일 목록 조회 에러:", error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (column) => {
    if (sortBy === column) {
      // 같은 컬럼을 다시 클릭하면 정렬 방향 전환
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      // 다른 컬럼 클릭 시 해당 컬럼으로 정렬
      setSortBy(column);
      setSortOrder("asc");
    }
  };

  const formatBytes = (bytes, decimals = 2) => {
    if (!bytes) return "0 Bytes";
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const getFileIcon = (mimetype) => {
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

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <div className="loading loading-spinner loading-lg"></div>
      </div>
    );
  }

  if (error) {
    return <div className="alert alert-error">{error}</div>;
  }

  return (
    <div>
      {/* 경로 표시 */}
      {directoryId && (
        <div className="breadcrumbs mb-4 text-sm">
          <ul>
            <li>
              <Link href="/dashboard">내 파일</Link>
            </li>
            {breadcrumbs.map((crumb, index) => (
              <li key={crumb.id}>
                {index === breadcrumbs.length - 1 ? (
                  crumb.name
                ) : (
                  <Link href={`/directory/${crumb.hash}`}>{crumb.name}</Link>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {directories.length === 0 && files.length === 0 ? (
        <div className="text-center py-8 bg-base-200 rounded-lg">
          <p className="text-lg">이 디렉토리에 파일이 없습니다.</p>
          <p className="text-gray-500 mt-2">
            파일을 업로드하거나 새 폴더를 만들어보세요.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="table w-full">
            <thead>
              <tr>
                <th
                  className="cursor-pointer"
                  onClick={() => handleSort("name")}
                >
                  이름
                  {sortBy === "name" && (
                    <span className="ml-1">
                      {sortOrder === "asc" ? "↑" : "↓"}
                    </span>
                  )}
                </th>
                <th
                  className="cursor-pointer"
                  onClick={() => handleSort("size")}
                >
                  크기
                  {sortBy === "size" && (
                    <span className="ml-1">
                      {sortOrder === "asc" ? "↑" : "↓"}
                    </span>
                  )}
                </th>
                <th
                  className="cursor-pointer"
                  onClick={() => handleSort("mimetype")}
                >
                  유형
                  {sortBy === "mimetype" && (
                    <span className="ml-1">
                      {sortOrder === "asc" ? "↑" : "↓"}
                    </span>
                  )}
                </th>
                <th
                  className="cursor-pointer"
                  onClick={() => handleSort("createdAt")}
                >
                  생성 일시
                  {sortBy === "createdAt" && (
                    <span className="ml-1">
                      {sortOrder === "asc" ? "↑" : "↓"}
                    </span>
                  )}
                </th>
              </tr>
            </thead>
            <tbody>
              {/* 디렉토리 목록 */}
              {directories.map((directory) => (
                <tr
                  key={`dir-${directory.id}`}
                  className="hover cursor-pointer"
                  onClick={() => router.push(`/directory/${directory.hash}`)}
                >
                  <td className="flex items-center gap-2">
                    <span className="text-xl">📁</span>
                    {directory.name}
                  </td>
                  <td>-</td>
                  <td>디렉토리</td>
                  <td>{formatDate(directory.createdAt)}</td>
                </tr>
              ))}

              {/* 파일 목록 */}
              {files.map((file) => (
                <tr
                  key={`file-${file.id}`}
                  className="hover cursor-pointer"
                  onClick={() => router.push(`/file/${file.hash}`)}
                >
                  <td className="flex items-center gap-2">
                    <span className="text-xl">
                      {getFileIcon(file.mimetype)}
                    </span>
                    {file.originalName}
                  </td>
                  <td>{formatBytes(file.size)}</td>
                  <td>{file.mimetype?.split("/")[1] || file.mimetype}</td>
                  <td>{formatDate(file.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
