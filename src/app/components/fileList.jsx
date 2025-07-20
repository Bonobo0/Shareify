"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  getFileList,
  getFileDownloadUrl,
  deleteFile,
  shareFile,
} from "@/actions/files";
import {
  getDirectoryList,
  getDirectoryDetails,
  deleteDirectoryRecursive,
} from "@/actions/directories";
import {
  downloadAndDecrypt,
  isMediaFile,
  decryptForPreview,
} from "@/lib/crypto/encryption";
import DirectoryShareModal from "./directoryShareModal";

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
  const [actionLoading, setActionLoading] = useState({});
  const [shareModal, setShareModal] = useState(null);
  const [shareEmail, setShareEmail] = useState("");
  const [sharePermission, setSharePermission] = useState("read");
  const [decryptModal, setDecryptModal] = useState(null);
  const [decryptPassword, setDecryptPassword] = useState("");
  const [previewModal, setPreviewModal] = useState(null);

  // 선택 관련 상태
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  // 모달 상태들
  const [alertModal, setAlertModal] = useState({ show: false, message: "" });
  const [confirmModal, setConfirmModal] = useState({
    show: false,
    message: "",
    callback: null,
  });

  // 디렉토리 공유 모달 상태
  const [directoryShareModal, setDirectoryShareModal] = useState({
    isOpen: false,
    directoryId: null,
    directoryName: "",
  });

  // 헬퍼 함수들
  const showAlert = (message) => {
    setAlertModal({ show: true, message });
  };

  const showConfirm = (message, callback) => {
    setConfirmModal({ show: true, message, callback });
  };

  // 선택 관련 핸들러
  const toggleSelectMode = () => {
    setSelectMode(!selectMode);
    setSelectedItems(new Set());
  };

  const toggleItemSelection = (type, id) => {
    const itemKey = `${type}-${id}`;
    const newSelected = new Set(selectedItems);

    if (newSelected.has(itemKey)) {
      newSelected.delete(itemKey);
    } else {
      newSelected.add(itemKey);
    }

    setSelectedItems(newSelected);
  };

  const selectAllItems = () => {
    const allItems = new Set();
    directories.forEach((dir) => allItems.add(`directory-${dir.id}`));
    files.forEach((file) => allItems.add(`file-${file.id}`));
    setSelectedItems(allItems);
  };

  const clearSelection = () => {
    setSelectedItems(new Set());
  };

  // 대량 삭제 핸들러
  const handleBulkDelete = async () => {
    console.log("handleBulkDelete 호출됨, selectedItems:", selectedItems);
    if (selectedItems.size === 0) return;

    showConfirm(
      `선택된 ${selectedItems.size}개 항목을 삭제하시겠습니까?`,
      async () => {
        console.log("삭제 확인됨, 삭제 시작");
        setBulkActionLoading(true);
        try {
          const deletePromises = [];

          selectedItems.forEach((itemKey) => {
            const [type, id] = itemKey.split("-");
            console.log(`삭제할 항목: ${type} - ${id}`);

            if (type === "file") {
              deletePromises.push(deleteFile({ fileId: id }));
            } else if (type === "directory") {
              deletePromises.push(
                deleteDirectoryRecursive({ directoryId: id })
              );
            }
          });

          console.log("삭제 요청들:", deletePromises.length);
          const results = await Promise.all(deletePromises);
          console.log("삭제 결과:", results);

          // 에러 확인 - success가 false이거나 error가 있는 경우
          const errors = results.filter(
            (result) => !result.success || result.error
          );
          if (errors.length > 0) {
            console.error("삭제 오류:", errors);
            setError(
              `일부 항목 삭제 실패: ${errors[0].error || "알 수 없는 오류"}`
            );
          } else {
            console.log("삭제 성공, 상태 업데이트");
            showAlert(
              `${selectedItems.size}개 항목이 성공적으로 삭제되었습니다.`
            );
            setSelectedItems(new Set());
            setSelectMode(false);
            // 목록 새로고침
            await fetchData();
          }
        } catch (error) {
          console.error("대량 삭제 오류:", error);
          setError("대량 삭제 중 오류가 발생했습니다.");
        } finally {
          setBulkActionLoading(false);
        }
      }
    );
  };

  // 디렉토리 재귀 삭제 핸들러 (소유자만 가능)
  const handleRecursiveDelete = async (directoryId) => {
    // 디렉토리 소유자 확인
    const directory = directories.find((dir) => dir.id === directoryId);
    if (!directory || !directory.owner) {
      setError("이 디렉토리를 삭제할 권한이 없습니다. (소유자만 가능)");
      return;
    }

    showConfirm(
      "이 디렉토리와 모든 하위 항목을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.",
      async () => {
        setActionLoading((prev) => ({ ...prev, [directoryId]: true }));
        try {
          const result = await deleteDirectoryRecursive({ directoryId });

          if (result.error) {
            setError(result.error);
          } else {
            await fetchData(); // 목록 새로고침
          }
        } catch (error) {
          setError("디렉토리 삭제 중 오류가 발생했습니다.");
        } finally {
          setActionLoading((prev) => ({ ...prev, [directoryId]: false }));
        }
      }
    );
  };

  // 디렉토리 공유 핸들러
  const handleShareDirectory = (directoryId, directoryName) => {
    setDirectoryShareModal({
      isOpen: true,
      directoryId,
      directoryName,
    });
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      // 파일 목록 가져오기
      const fileResult = await getFileList({
        directoryId: directoryId || null,
        sortBy,
        sortOrder,
      });

      if (fileResult.error) {
        console.error("파일 목록 조회 오류:", fileResult.error);
        throw new Error(fileResult.error);
      }

      setFiles(fileResult.files || []);

      // 디렉토리 목록 가져오기
      const dirResult = await getDirectoryList({
        parentId: directoryId || null,
      });

      if (dirResult.error) {
        throw new Error(dirResult.error);
      }

      setDirectories(dirResult.directories || []);

      // 현재 디렉토리 정보 가져오기 (만약 하위 디렉토리라면)
      if (directoryId) {
        const currentDirResult = await getDirectoryDetails({
          directoryId,
        });

        if (currentDirResult.success) {
          setCurrentDirectory(currentDirResult.directory);
          // TODO: breadcrumbs 구현 필요
          setBreadcrumbs([]);
        }
      } else {
        // 루트 디렉토리인 경우
        setCurrentDirectory(null);
        setBreadcrumbs([]);
      }
    } catch (error) {
      console.error("데이터 조회 에러:", error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  }, [directoryId, sortBy, sortOrder]);

  useEffect(() => {
    fetchData();
  }, [directoryId, refreshTrigger, sortBy, sortOrder, fetchData]);

  // E2EE 관련 함수들
  const handleDownload = async (file) => {
    if (file.isEncrypted) {
      setDecryptModal({ ...file, action: "download" });
      return;
    }

    setActionLoading((prev) => ({ ...prev, [file.id]: true }));
    setError("");

    try {
      const result = await getFileDownloadUrl({ fileId: file.id });

      if (result.error) {
        setError(result.error);
        return;
      }

      // 일반 파일 다운로드
      const link = document.createElement("a");
      link.href = result.downloadUrl;
      link.download = file.originalName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      setError("다운로드 중 오류가 발생했습니다.");
    } finally {
      setActionLoading((prev) => ({ ...prev, [file.id]: false }));
    }
  };

  const handleEncryptedDownload = async () => {
    if (!decryptPassword) {
      setError("복호화 키를 입력해주세요.");
      return;
    }

    const file = decryptModal;
    setActionLoading((prev) => ({ ...prev, [file.id]: true }));
    setError("");

    try {
      const result = await getFileDownloadUrl({ fileId: file.id });

      if (result.error) {
        setError(result.error);
        return;
      }

      const metadata = {
        originalName: file.originalName,
        originalType: file.originalMimetype,
        originalSize: file.originalSize,
      };

      const downloadResult = await downloadAndDecrypt(
        result.downloadUrl,
        decryptPassword,
        metadata
      );

      if (downloadResult.error) {
        setError(downloadResult.error);
        return;
      }

      setDecryptModal(null);
      setDecryptPassword("");
    } catch (err) {
      setError("복호화 및 다운로드 중 오류가 발생했습니다.");
    } finally {
      setActionLoading((prev) => ({ ...prev, [file.id]: false }));
    }
  };

  const handlePreview = async (file) => {
    if (!file.isEncrypted) {
      // 일반 파일 미리보기
      try {
        const result = await getFileDownloadUrl({ fileId: file.id });
        if (result.error) {
          setError(result.error);
          return;
        }
        setPreviewModal({ file, url: result.downloadUrl });
      } catch (err) {
        setError("미리보기를 불러올 수 없습니다.");
      }
      return;
    }

    // 암호화된 파일 미리보기
    setDecryptModal({ ...file, action: "preview" });
  };

  const handleEncryptedPreview = async () => {
    if (!decryptPassword) {
      setError("복호화 키를 입력해주세요.");
      return;
    }

    const file = decryptModal;
    setActionLoading((prev) => ({ ...prev, [file.id]: true }));
    setError("");

    try {
      const result = await getFileDownloadUrl({ fileId: file.id });

      if (result.error) {
        setError(result.error);
        return;
      }

      // 암호화된 파일 다운로드
      const response = await fetch(result.downloadUrl);
      const encryptedArrayBuffer = await response.arrayBuffer();

      // 복호화
      const decryptResult = await decryptForPreview(
        encryptedArrayBuffer,
        decryptPassword
      );

      if (decryptResult.error) {
        setError(decryptResult.error);
        return;
      }

      const previewUrl = URL.createObjectURL(decryptResult.blob);
      setPreviewModal({ file, url: previewUrl });
      setDecryptModal(null);
      setDecryptPassword("");
    } catch (err) {
      setError(
        "미리보기 생성 중 오류가 발생했습니다. 복호화 키가 올바른지 확인해주세요."
      );
    } finally {
      setActionLoading((prev) => ({ ...prev, [file.id]: false }));
    }
  };

  const handleDelete = async (fileId) => {
    showConfirm("정말로 이 파일을 삭제하시겠습니까?", async () => {
      setActionLoading((prev) => ({ ...prev, [fileId]: true }));
      setError("");

      try {
        const result = await deleteFile({ fileId });

        if (result.error) {
          setError(result.error);
          return;
        }

        // 파일 목록에서 제거
        setFiles((prev) => prev.filter((file) => file.id !== fileId));
      } catch (err) {
        setError("파일 삭제 중 오류가 발생했습니다.");
      } finally {
        setActionLoading((prev) => ({ ...prev, [fileId]: false }));
      }
    });
  };

  const handleShare = async () => {
    if (!shareEmail) {
      setError("공유할 이메일을 입력해주세요.");
      return;
    }

    setActionLoading((prev) => ({ ...prev, share: true }));
    setError("");

    try {
      const result = await shareFile({
        fileId: shareModal.id,
        email: shareEmail,
        permission: sharePermission,
      });

      if (result.error) {
        setError(result.error);
        return;
      }

      setShareModal(null);
      setShareEmail("");
      setSharePermission("read");
    } catch (err) {
      setError("파일 공유 중 오류가 발생했습니다.");
    } finally {
      setActionLoading((prev) => ({ ...prev, share: false }));
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

  const isPreviewable = (file) => {
    const mimetype = file.isEncrypted ? file.originalMimetype : file.mimetype;
    return isMediaFile(mimetype);
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

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <div className="loading loading-spinner loading-lg"></div>
      </div>
    );
  }

  return (
    <div>
      {error && <div className="alert alert-error mb-4">{error}</div>}
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
        <div className="space-y-4">
          {/* 대량 액션 컨트롤 */}
          <div className="flex items-center justify-between bg-base-200 p-4 rounded-lg">
            <div className="flex items-center gap-4">
              <button
                onClick={toggleSelectMode}
                className={`btn btn-sm ${
                  selectMode ? "btn-primary" : "btn-outline"
                }`}
              >
                {selectMode ? "선택 모드 종료" : "다중 선택"}
              </button>

              {selectMode && (
                <>
                  <button
                    onClick={selectAllItems}
                    className="btn btn-sm btn-ghost"
                    disabled={
                      selectedItems.size === files.length + directories.length
                    }
                  >
                    전체 선택
                  </button>

                  <button
                    onClick={clearSelection}
                    className="btn btn-sm btn-ghost"
                    disabled={selectedItems.size === 0}
                  >
                    선택 해제
                  </button>

                  <span className="text-sm text-gray-600">
                    {selectedItems.size}개 항목 선택됨
                  </span>
                </>
              )}
            </div>

            {selectMode && selectedItems.size > 0 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleBulkDelete}
                  className={`btn btn-sm btn-error ${
                    bulkActionLoading ? "loading" : ""
                  }`}
                  disabled={bulkActionLoading}
                >
                  선택한 항목 삭제
                </button>
              </div>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="table w-full">
              <thead>
                <tr>
                  {selectMode && (
                    <th>
                      <input
                        type="checkbox"
                        className="checkbox"
                        checked={
                          selectedItems.size ===
                            files.length + directories.length &&
                          files.length + directories.length > 0
                        }
                        onChange={(e) => {
                          if (e.target.checked) {
                            selectAllItems();
                          } else {
                            clearSelection();
                          }
                        }}
                      />
                    </th>
                  )}
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
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {/* 디렉토리 목록 */}
                {directories.map((directory) => (
                  <tr
                    key={`dir-${directory.id}`}
                    className="hover cursor-pointer"
                    onClick={(e) => {
                      if (selectMode) {
                        e.preventDefault();
                        toggleItemSelection("directory", directory.id);
                      } else {
                        router.push(`/directory/${directory.hash}`);
                      }
                    }}
                  >
                    {selectMode && (
                      <td onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          className="checkbox"
                          checked={selectedItems.has(
                            `directory-${directory.id}`
                          )}
                          onChange={() =>
                            toggleItemSelection("directory", directory.id)
                          }
                        />
                      </td>
                    )}
                    <td className="flex items-center gap-2">
                      <span className="text-xl">📁</span>
                      <div>
                        <div className="font-medium">{directory.name}</div>
                        {!directory.owner && directory.ownerInfo && (
                          <div className="flex items-center gap-1 mt-1">
                            <div className="badge badge-accent badge-sm gap-1">
                              <span>👤</span>
                              <span>
                                {directory.ownerInfo.name ||
                                  directory.ownerInfo.email}
                                님이 공유
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                    <td>-</td>
                    <td>디렉토리</td>
                    <td>{formatDate(directory.createdAt)}</td>
                    <td>
                      <div className="dropdown dropdown-end">
                        <label
                          tabIndex={0}
                          className="btn btn-ghost btn-sm"
                          onClick={(e) => e.stopPropagation()}
                        >
                          ⋮
                        </label>
                        <ul
                          tabIndex={0}
                          className="dropdown-content menu p-2 shadow bg-base-100 rounded-box w-52"
                        >
                          <li>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleShareDirectory(
                                  directory.id,
                                  directory.name
                                );
                              }}
                              className="text-blue-500"
                            >
                              공유하기
                            </button>
                          </li>
                          <li>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRecursiveDelete(directory.id);
                              }}
                              className="text-red-500"
                              disabled={actionLoading[directory.id]}
                            >
                              삭제 (모든 하위 항목 포함)
                            </button>
                          </li>
                        </ul>
                      </div>
                    </td>
                  </tr>
                ))}

                {/* 파일 목록 */}
                {files.map((file) => (
                  <tr
                    key={`file-${file.id}`}
                    className="hover cursor-pointer"
                    onClick={(e) => {
                      if (selectMode) {
                        e.preventDefault();
                        toggleItemSelection("file", file.id);
                      } else {
                        router.push(`/file/${file.hash}`);
                      }
                    }}
                  >
                    {selectMode && (
                      <td onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          className="checkbox"
                          checked={selectedItems.has(`file-${file.id}`)}
                          onChange={() => toggleItemSelection("file", file.id)}
                        />
                      </td>
                    )}
                    <td>
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{getFileIcon(file)}</span>
                        <div>
                          <div className="font-medium">{file.originalName}</div>
                          <div className="flex items-center gap-2 mt-1">
                            {file.isEncrypted && (
                              <div className="badge badge-primary badge-sm">
                                🔒 암호화됨
                              </div>
                            )}
                            {file.isPublic && (
                              <div className="badge badge-success badge-sm">
                                공개
                              </div>
                            )}
                            {!file.owner && file.ownerInfo && (
                              <div className="badge badge-accent badge-sm gap-1">
                                <span>👤</span>
                                <span>
                                  {file.ownerInfo.name || file.ownerInfo.email}
                                  님이 공유
                                </span>
                              </div>
                            )}
                            {file.owner &&
                              file.parentDirectoryInfo &&
                              file.parentDirectoryInfo.owner.id !==
                                file.ownerInfo.id && (
                                <div className="badge badge-info badge-sm gap-1">
                                  <span>📁</span>
                                  <span>
                                    {file.parentDirectoryInfo.owner.name ||
                                      file.parentDirectoryInfo.owner.email}
                                    님의 {file.parentDirectoryInfo.name}에
                                    업로드됨
                                  </span>
                                </div>
                              )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      {formatBytes(
                        file.isEncrypted ? file.originalSize : file.size
                      )}
                    </td>
                    <td>
                      {file.isEncrypted
                        ? file.originalMimetype?.split("/")[1] ||
                          file.originalMimetype
                        : file.mimetype?.split("/")[1] || file.mimetype}
                    </td>
                    <td>{formatDate(file.createdAt)}</td>
                    <td>
                      <div className="flex gap-2">
                        <button
                          className={`btn btn-primary btn-sm ${
                            actionLoading[file.id] ? "loading" : ""
                          }`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownload(file);
                          }}
                          disabled={actionLoading[file.id]}
                        >
                          다운로드
                        </button>

                        {isPreviewable(file) && (
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePreview(file);
                            }}
                            disabled={actionLoading[file.id]}
                          >
                            미리보기
                          </button>
                        )}

                        <div className="dropdown dropdown-end">
                          <label
                            tabIndex={0}
                            className="btn btn-ghost btn-sm"
                            onClick={(e) => e.stopPropagation()}
                          >
                            ⋮
                          </label>
                          <ul
                            tabIndex={0}
                            className="dropdown-content menu p-2 shadow bg-base-100 rounded-box w-52"
                          >
                            <li>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShareModal(file);
                                }}
                              >
                                공유
                              </button>
                            </li>
                            <li>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDelete(file.id);
                                }}
                                className="text-red-500"
                                disabled={actionLoading[file.id]}
                              >
                                삭제
                              </button>
                            </li>
                          </ul>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {/* 암호화 파일 복호화 모달 */}
      {decryptModal && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg">
              {decryptModal.action === "download"
                ? "파일 다운로드"
                : "미리보기"}
            </h3>
            <p className="py-4">
              이 파일은 암호화되어 있습니다. 복호화 키를 입력해주세요.
            </p>
            <p className="text-sm text-gray-500 mb-4">
              파일: {decryptModal.originalName}
            </p>

            <div className="form-control">
              <label className="label">
                <span className="label-text">복호화 키</span>
              </label>
              <input
                type="password"
                className="input input-bordered"
                placeholder="암호화 시 사용한 비밀번호를 입력하세요"
                value={decryptPassword}
                onChange={(e) => setDecryptPassword(e.target.value)}
              />
            </div>

            <div className="modal-action">
              <button
                className="btn"
                onClick={() => {
                  setDecryptModal(null);
                  setDecryptPassword("");
                }}
              >
                취소
              </button>
              <button
                className={`btn btn-primary ${
                  actionLoading[decryptModal.id] ? "loading" : ""
                }`}
                onClick={
                  decryptModal.action === "download"
                    ? handleEncryptedDownload
                    : handleEncryptedPreview
                }
                disabled={actionLoading[decryptModal.id]}
              >
                {decryptModal.action === "download" ? "다운로드" : "미리보기"}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* 미리보기 모달 */}
      {previewModal && (
        <div className="modal modal-open">
          <div className="modal-box max-w-4xl">
            <h3 className="font-bold text-lg">
              {previewModal.file.originalName}
            </h3>
            <div className="py-4">
              {previewModal.file.mimetype?.startsWith("image/") ||
              previewModal.file.originalMimetype?.startsWith("image/") ? (
                <img
                  src={previewModal.url}
                  alt={previewModal.file.originalName}
                  className="max-w-full h-auto"
                />
              ) : previewModal.file.mimetype?.startsWith("video/") ||
                previewModal.file.originalMimetype?.startsWith("video/") ? (
                <video
                  src={previewModal.url}
                  controls
                  className="max-w-full h-auto"
                />
              ) : previewModal.file.mimetype?.startsWith("audio/") ||
                previewModal.file.originalMimetype?.startsWith("audio/") ? (
                <audio src={previewModal.url} controls className="w-full" />
              ) : (
                <p>미리보기를 지원하지 않는 파일 형식입니다.</p>
              )}
            </div>
            <div className="modal-action">
              <button
                className="btn"
                onClick={() => {
                  if (previewModal.url.startsWith("blob:")) {
                    URL.revokeObjectURL(previewModal.url);
                  }
                  setPreviewModal(null);
                }}
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
      {/* 공유 모달 */}
      {shareModal && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg">파일 공유</h3>
            <p className="py-4">파일: {shareModal.originalName}</p>

            <div className="form-control">
              <label className="label">
                <span className="label-text">이메일</span>
              </label>
              <input
                type="email"
                className="input input-bordered"
                placeholder="공유할 사용자의 이메일"
                value={shareEmail}
                onChange={(e) => setShareEmail(e.target.value)}
              />
            </div>

            <div className="form-control mt-4">
              <label className="label">
                <span className="label-text">권한</span>
              </label>
              <select
                className="select select-bordered"
                value={sharePermission}
                onChange={(e) => setSharePermission(e.target.value)}
              >
                <option value="read">읽기</option>
                <option value="write">읽기/쓰기</option>
                <option value="admin">관리자</option>
              </select>
            </div>

            <div className="modal-action">
              <button
                className="btn"
                onClick={() => {
                  setShareModal(null);
                  setShareEmail("");
                  setSharePermission("read");
                }}
              >
                취소
              </button>
              <button
                className={`btn btn-primary ${
                  actionLoading.share ? "loading" : ""
                }`}
                onClick={handleShare}
                disabled={actionLoading.share}
              >
                공유
              </button>
            </div>
          </div>
        </div>
      )}
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
      {/* 디렉토리 공유 모달 */}
      <DirectoryShareModal
        isOpen={directoryShareModal.isOpen}
        onClose={() =>
          setDirectoryShareModal({
            isOpen: false,
            directoryId: null,
            directoryName: "",
          })
        }
        directoryId={directoryShareModal.directoryId}
        directoryName={directoryShareModal.directoryName}
      />
    </div>
  );
}
