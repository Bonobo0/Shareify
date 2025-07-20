"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Navbar from "../components/navbar";
import BulkActionHandler from "../components/bulkActionHandler";
import { getMyUploadedFiles } from "@/actions/files";
import { useAuth } from "@/context/AuthContext";

export default function MyUploadsPage() {
  const router = useRouter();
  const { user, loading: authLoading, isAuthenticated } = useAuth();

  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    totalFiles: 0,
    totalPages: 0,
    hasNextPage: false,
    hasPrevPage: false,
  });

  // 모달 상태들
  const [alertModal, setAlertModal] = useState({ show: false, message: "" });
  const [confirmModal, setConfirmModal] = useState({
    show: false,
    message: "",
    callback: null,
  });

  // 헬퍼 함수들
  const showAlert = (message) => {
    setAlertModal({ show: true, message });
  };

  const showConfirm = (message, callback) => {
    setConfirmModal({ show: true, message, callback });
  };

  const fetchMyUploads = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const result = await getMyUploadedFiles({
        page: pagination.page,
        limit: pagination.limit,
        sortBy: "createdAt",
        sortOrder: "desc",
      });

      if (result.error) {
        setError(result.error);
        return;
      }

      setFiles(result.files || []);
      setPagination((prev) => ({
        ...prev,
        ...result.pagination,
      }));
    } catch (err) {
      setError("파일 목록을 불러오는 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit]);

  // BulkActionHandler 초기화
  const bulkHandler = BulkActionHandler({
    selectedItems,
    onSelectionChange: setSelectedItems,
    onRefresh: fetchMyUploads,
    onShowAlert: showAlert,
    onShowConfirm: showConfirm,
    files,
    directories: [], // my-uploads에는 디렉토리가 없음
  });

  useEffect(() => {
    if (authLoading) return;

    if (!isAuthenticated) {
      router.push("/user/signin");
      return;
    }

    fetchMyUploads();
  }, [isAuthenticated, authLoading, router, fetchMyUploads]);

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

  const getFileIcon = (file) => {
    const mimetype = file.isEncrypted ? file.originalMimetype : file.mimetype;
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

  const handlePageChange = (newPage) => {
    setPagination((prev) => ({ ...prev, page: newPage }));
  };

  if (authLoading || loading) {
    return (
      <>
        <Navbar />
        <main className="flex min-h-screen flex-col items-center justify-center">
          <div className="loading loading-spinner loading-lg"></div>
        </main>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <main className="flex min-h-screen flex-col p-4 md:p-8 pt-20">
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

        {error && <div className="alert alert-error mb-4">{error}</div>}

        {files.length === 0 ? (
          <div className="text-center py-12 bg-base-200 rounded-lg">
            <div className="text-6xl mb-4">📂</div>
            <p className="text-lg">업로드한 파일이 없습니다.</p>
            <p className="text-gray-500 mt-2">파일을 업로드해보세요.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="stats shadow">
              <div className="stat">
                <div className="stat-title">총 파일 수</div>
                <div className="stat-value">{pagination.totalFiles}</div>
                <div className="stat-desc">업로드</div>
              </div>
            </div>
            {/* 대량 액션 컨트롤 */}
            {React.createElement(bulkHandler.BulkActionControls)}
            <div className="overflow-x-auto">
              <table className="table w-full">
                <thead>
                  <tr>
                    {React.createElement(bulkHandler.SelectAllCheckbox)}
                    <th>파일명</th>
                    <th>위치</th>
                    <th>크기</th>
                    <th>유형</th>
                    <th>업로드일</th>
                    <th>작업</th>
                  </tr>
                </thead>
                <tbody>
                  {files.map((file) => (
                    <tr
                      key={file.id}
                      className={`hover ${
                        selectedItems.has(`file-${file.id}`)
                          ? "bg-primary/10"
                          : ""
                      }`}
                    >
                      {React.createElement(bulkHandler.ItemCheckbox, {
                        type: "file",
                        id: file.id,
                        onClick: (e) => e.stopPropagation(),
                      })}
                      <td
                        className="cursor-pointer"
                        onClick={() => router.push(`/file/${file.hash}`)}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{getFileIcon(file)}</span>
                          <div>
                            <div className="font-medium">
                              {file.originalName}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              {file.isEncrypted && (
                                <div className="badge badge-primary badge-sm">
                                  🔒 암호화됨
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td
                        className="cursor-pointer"
                        onClick={() => router.push(`/file/${file.hash}`)}
                      >
                        <div className="badge badge-info badge-sm gap-1">
                          <span>📁</span>
                          <span>
                            {file.parentDirectoryInfo.owner.name ||
                              file.parentDirectoryInfo.owner.email}
                            님의 {file.parentDirectoryInfo.name}
                          </span>
                        </div>
                      </td>
                      <td
                        className="cursor-pointer"
                        onClick={() => router.push(`/file/${file.hash}`)}
                      >
                        {formatBytes(
                          file.isEncrypted ? file.originalSize : file.size
                        )}
                      </td>
                      <td
                        className="cursor-pointer"
                        onClick={() => router.push(`/file/${file.hash}`)}
                      >
                        {file.isEncrypted
                          ? file.originalMimetype?.split("/")[1] ||
                            file.originalMimetype
                          : file.mimetype?.split("/")[1] || file.mimetype}
                      </td>
                      <td
                        className="cursor-pointer"
                        onClick={() => router.push(`/file/${file.hash}`)}
                      >
                        {formatDate(file.createdAt)}
                      </td>
                      <td>
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/file/${file.hash}`);
                          }}
                        >
                          보기
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 페이지네이션 */}
            {pagination.totalPages > 1 && (
              <div className="flex justify-center mt-6">
                <div className="join">
                  <button
                    className="join-item btn"
                    disabled={!pagination.hasPrevPage}
                    onClick={() => handlePageChange(pagination.page - 1)}
                  >
                    이전
                  </button>

                  {Array.from(
                    { length: pagination.totalPages },
                    (_, i) => i + 1
                  ).map((pageNum) => (
                    <button
                      key={pageNum}
                      className={`join-item btn ${
                        pageNum === pagination.page ? "btn-active" : ""
                      }`}
                      onClick={() => handlePageChange(pageNum)}
                    >
                      {pageNum}
                    </button>
                  ))}

                  <button
                    className="join-item btn"
                    disabled={!pagination.hasNextPage}
                    onClick={() => handlePageChange(pagination.page + 1)}
                  >
                    다음
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Alert Modal */}
      {alertModal.show && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg">알림</h3>
            <p className="py-4">{alertModal.message}</p>
            <div className="modal-action">
              <button
                className="btn btn-primary"
                onClick={() => setAlertModal({ show: false, message: "" })}
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Modal */}
      {confirmModal.show && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg">확인</h3>
            <p className="py-4">{confirmModal.message}</p>
            <div className="modal-action">
              <button
                className="btn btn-outline"
                onClick={() =>
                  setConfirmModal({ show: false, message: "", callback: null })
                }
              >
                취소
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  if (confirmModal.callback) {
                    confirmModal.callback();
                  }
                  setConfirmModal({ show: false, message: "", callback: null });
                }}
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
