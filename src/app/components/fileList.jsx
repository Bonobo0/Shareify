"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  getFileList,
  getFileDownloadUrl,
  deleteFile,
  shareFile,
  getFileDetails,
  getMyUploadedFiles,
} from "@/actions/files";
import {
  getDirectoryList,
  getDirectoryDetails,
  deleteDirectoryRecursive,
  getDirectoryBreadcrumbs,
} from "@/actions/directories";
import {
  downloadAndDecrypt,
  isMediaFile,
  decryptForPreview,
} from "@/lib/crypto/encryption";
import DirectoryShareModal from "./directoryShareModal";
import EditDirectoryModal from "./editDirectoryModal";
import BulkDownloadModal from "./bulkDownloadModal";
import ShareModal from "./shareModal";
import BulkActionHandler from "./bulkActionHandler";
import SelectedDownloadModal from "./selectedDownloadModal";
import Paginator from "./paginator";

export default function FileList({
  directoryId = null,
  refreshTrigger = 0,
  mode = "directory", // "directory" | "my-uploads"
  showDirectories = true,
  shareLinkHash = null,
}) {
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
  const [shareModal, setShareModal] = useState({ isOpen: false, fileId: null });
  const [decryptModal, setDecryptModal] = useState(null);
  const [decryptPassword, setDecryptPassword] = useState("");
  const [previewModal, setPreviewModal] = useState(null);

  // 선택 관련 상태 (BulkActionHandler로 이동)
  const [selectedItems, setSelectedItems] = useState(new Set());

  // 페이지네이션 상태
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [itemsPerPage] = useState(10); // 페이지당 아이템 수(디렉토리, 파일 별개 처리)

  // 검색 상태
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFilters, setSearchFilters] = useState({
    name: "",
    dateFrom: "",
    dateTo: "",
    sizeMin: "",
    sizeMax: "",
    fileType: "",
    permission: "", // "owner", "shared", "all"
  });
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const [fileTypeOptions, setFileTypeOptions] = useState([]);
  const [filteredFiles, setFilteredFiles] = useState([]);
  const [filteredDirectories, setFilteredDirectories] = useState([]);

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

  // 디렉토리 수정 모달 상태
  const [editDirectoryModal, setEditDirectoryModal] = useState({
    isOpen: false,
    directoryId: null,
    directoryName: "",
    directoryDescription: "",
  });

  // 전체 다운로드 모달 상태
  const [bulkDownloadModal, setBulkDownloadModal] = useState({
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

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      if (mode === "my-uploads") {
        // my-uploads 모드: 내가 업로드한 파일만 가져오기
        const result = await getMyUploadedFiles({
          page: currentPage,
          limit: itemsPerPage,
          sortBy,
          sortOrder,
        });

        if (result.error) {
          throw new Error(result.error);
        }

        setFiles(result.files || []);
        setDirectories([]); // my-uploads에서는 디렉토리 없음
        setTotalItems(result.pagination?.totalFiles || 0);
        setTotalPages(result.pagination?.totalPages || 1);
        setCurrentDirectory(null);
        setBreadcrumbs([]);
      } else {
        // directory 모드: 기존 로직
        // 파일 목록 가져오기 (페이지네이션 포함)
        const fileResult = await getFileList({
          directoryId: directoryId || null,
          sortBy,
          sortOrder,
          page: currentPage,
          limit: itemsPerPage,
          shareLinkHash, // 공유 링크 해시 추가
        });

        if (fileResult.error) {
          throw new Error(fileResult.error);
        }

        setFiles(fileResult.files || []);

        if (showDirectories) {
          // 디렉토리 목록 가져오기 (디렉토리는 페이지네이션 없이)
          const dirResult = await getDirectoryList({
            parentId: directoryId || null,
            page: currentPage,
            limit: itemsPerPage,
            sortBy,
            sortOrder,
            shareLinkHash, // 공유 링크 해시 추가
          });

          if (dirResult.error) {
            throw new Error(dirResult.error);
          }
          setDirectories(dirResult.directories || []);
          const fileCount = fileResult.pagination?.totalFiles || 0;

          // 파일과 디렉토리 총 개수를 한 번에 설정
          const totalCombinedItems = fileCount;
          setTotalItems(totalCombinedItems);

          // 페이지 계산: 실제 화면에 표시되는 아이템 수를 기준으로 계산
          // 현재 페이지에 표시되는 실제 아이템 수
          const currentPageItems =
            (fileResult.files?.length || 0) +
            (dirResult.directories?.length || 0);

          // 만약 현재 페이지에 아이템이 itemsPerPage보다 적고, 이것이 마지막 페이지라면
          if (
            currentPageItems < itemsPerPage &&
            totalCombinedItems <= currentPage * itemsPerPage
          ) {
            setTotalPages(currentPage);
          } else {
            setTotalPages(Math.ceil(totalCombinedItems / itemsPerPage) || 1);
          }
        } else {
          setDirectories([]);
          setTotalItems(fileResult.pagination.totalFiles || 0);
          setTotalPages(fileResult.pagination.totalPages || 1);
        }

        // 현재 디렉토리 정보 가져오기 (만약 하위 디렉토리라면)
        if (directoryId) {
          const currentDirResult = await getDirectoryDetails({
            directoryId,
          });

          if (currentDirResult.success) {
            setCurrentDirectory(currentDirResult.directory);

            // breadcrumbs 가져오기
            const breadcrumbsResult = await getDirectoryBreadcrumbs({
              directoryId,
            });

            if (breadcrumbsResult.success) {
              setBreadcrumbs(breadcrumbsResult.breadcrumbs);
            } else {
              setBreadcrumbs([]);
            }
          }
        } else {
          // 루트 디렉토리인 경우
          setCurrentDirectory(null);
          setBreadcrumbs([]);
        }
      }
    } catch (error) {
      console.error("데이터 조회 에러:", error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  }, [
    directoryId,
    sortBy,
    sortOrder,
    currentPage,
    itemsPerPage,
    mode,
    showDirectories,
    shareLinkHash,
  ]);

  // 개별 파일 업데이트 함수 (깜빡임 방지)
  const updateSingleFile = useCallback(
    async (fileId) => {
      try {
        const result = await getFileDetails({ fileId });
        if (result.success && result.file) {
          setFiles((prevFiles) =>
            prevFiles.map((file) => (file.id === fileId ? result.file : file))
          );
        }
      } catch (error) {
        console.error("파일 업데이트 에러:", error);
        // 실패 시 전체 새로고침으로 폴백
        await fetchData();
      }
    },
    [fetchData]
  );

  // 개별 디렉토리 업데이트 함수 (깜빡임 방지)
  const updateSingleDirectory = useCallback(
    async (directoryId) => {
      try {
        const result = await getDirectoryDetails({ directoryId });
        if (result.success && result.directory) {
          setDirectories((prevDirs) =>
            prevDirs.map((dir) =>
              dir.id === directoryId ? result.directory : dir
            )
          );
        }
      } catch (error) {
        console.error("디렉토리 업데이트 에러:", error);
        // 실패 시 전체 새로고침으로 폴백
        await fetchData();
      }
    },
    [fetchData]
  );

  // BulkActionHandler 초기화
  const bulkHandler = BulkActionHandler({
    selectedItems,
    onSelectionChange: setSelectedItems,
    onRefresh: fetchData,
    onShowAlert: showAlert,
    onShowConfirm: showConfirm,
    files: filteredFiles,
    directories: filteredDirectories,
  });

  // 파일 타입 자동완성 옵션 생성
  const generateFileTypeOptions = useCallback(() => {
    const types = new Set();
    files.forEach((file) => {
      if (file.originalName) {
        const extension = file.originalName.split(".").pop()?.toLowerCase();
        if (extension) {
          types.add(extension);
        }
      }
    });
    setFileTypeOptions(Array.from(types).sort());
  }, [files]);

  // 검색 필터 적용 함수
  const applySearchFilters = useCallback(() => {
    let filtered_files = [...files];
    let filtered_directories = [...directories];

    // 이름 필터
    if (searchFilters.name) {
      const nameQuery = searchFilters.name.toLowerCase();
      filtered_files = filtered_files.filter(
        (file) =>
          file.originalName?.toLowerCase().includes(nameQuery) ||
          file.name?.toLowerCase().includes(nameQuery)
      );
      filtered_directories = filtered_directories.filter((dir) =>
        dir.name?.toLowerCase().includes(nameQuery)
      );
    }

    // 날짜 필터 (생성일 기준)
    if (searchFilters.dateFrom) {
      const fromDate = new Date(searchFilters.dateFrom);
      filtered_files = filtered_files.filter(
        (file) => new Date(file.createdAt) >= fromDate
      );
      filtered_directories = filtered_directories.filter(
        (dir) => new Date(dir.createdAt) >= fromDate
      );
    }

    if (searchFilters.dateTo) {
      const toDate = new Date(searchFilters.dateTo);
      toDate.setHours(23, 59, 59, 999); // 해당 날짜 끝까지
      filtered_files = filtered_files.filter(
        (file) => new Date(file.createdAt) <= toDate
      );
      filtered_directories = filtered_directories.filter(
        (dir) => new Date(dir.createdAt) <= toDate
      );
    }

    // 파일 크기 필터 (파일만 적용)
    if (searchFilters.sizeMin) {
      const minSize = parseFloat(searchFilters.sizeMin) * 1024 * 1024; // MB to bytes
      filtered_files = filtered_files.filter((file) => file.size >= minSize);
    }

    if (searchFilters.sizeMax) {
      const maxSize = parseFloat(searchFilters.sizeMax) * 1024 * 1024; // MB to bytes
      filtered_files = filtered_files.filter((file) => file.size <= maxSize);
    }

    // 파일 타입 필터
    if (searchFilters.fileType) {
      const typeQuery = searchFilters.fileType.toLowerCase();
      filtered_files = filtered_files.filter((file) => {
        const extension = file.originalName?.split(".").pop()?.toLowerCase();
        return extension === typeQuery;
      });
    }

    // 권한 필터
    if (searchFilters.permission && searchFilters.permission !== "all") {
      if (searchFilters.permission === "owner") {
        filtered_files = filtered_files.filter((file) => file.owner);
        filtered_directories = filtered_directories.filter((dir) => dir.owner);
      } else if (searchFilters.permission === "shared") {
        filtered_files = filtered_files.filter((file) => !file.owner);
        filtered_directories = filtered_directories.filter((dir) => !dir.owner);
      }
    }

    setFilteredFiles(filtered_files);
    setFilteredDirectories(filtered_directories);
  }, [files, directories, searchFilters]);

  // 검색 초기화 함수
  const resetSearch = () => {
    setSearchQuery("");
    setSearchFilters({
      name: "",
      dateFrom: "",
      dateTo: "",
      sizeMin: "",
      sizeMax: "",
      fileType: "",
      permission: "",
    });
    setShowAdvancedSearch(false);
  };

  // 간단 검색 함수 (이름만)
  const handleSimpleSearch = (query) => {
    setSearchQuery(query);
    setSearchFilters((prev) => ({ ...prev, name: query }));
  };

  // 선택 관련 핸들러 (BulkActionHandler에서 제공)

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

            // 페이지 유효성 검사: 데이터 새로고침 후 현재 페이지가 유효한지 확인
            // 이는 useEffect에서 fetchData 완료 후 자동으로 처리됨
          }
          showAlert("디렉토리와 모든 하위 항목이 성공적으로 삭제되었습니다.");
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

  // 디렉토리 수정 핸들러
  const handleEditDirectory = (directory) => {
    setEditDirectoryModal({
      isOpen: true,
      directoryId: directory.id,
      directoryName: directory.name,
      directoryDescription: directory.description || "",
    });
  };

  // 전체 다운로드 핸들러
  const handleBulkDownload = () => {
    setBulkDownloadModal({
      isOpen: true,
      directoryId: directoryId,
      directoryName: currentDirectory?.name || "루트 폴더",
    });
  };

  useEffect(() => {
    fetchData();
  }, [directoryId, refreshTrigger, fetchData]);

  // 파일 타입 옵션 생성
  useEffect(() => {
    generateFileTypeOptions();
  }, [generateFileTypeOptions]);

  // 검색 필터 적용
  useEffect(() => {
    applySearchFilters();
  }, [applySearchFilters]);

  // 디렉토리가 변경되면 첫 페이지로 이동 및 선택 초기화
  useEffect(() => {
    setCurrentPage(1);
    setSelectedItems(new Set()); // 디렉토리 변경 시 선택 항목도 초기화
    resetSearch(); // 디렉토리 변경 시 검색도 초기화
  }, [directoryId]);

  // 총 페이지 수가 변경되었을 때 현재 페이지 유효성 검사
  useEffect(() => {
    if (totalPages > 0 && (currentPage > totalPages || currentPage < 1)) {
      setCurrentPage(Math.min(Math.max(1, currentPage), totalPages));
    }
  }, [totalPages, currentPage]);

  // 페이지 변경 핸들러
  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
    setSelectedItems(new Set()); // 페이지 변경 시 선택 초기화
  };

  // E2EE 관련 함수들
  const handleDownload = async (file) => {
    if (file.isEncrypted) {
      setDecryptModal({ ...file, action: "download" });
      return;
    }

    setActionLoading((prev) => ({ ...prev, [file.id]: true }));
    setError("");

    try {
      const result = await getFileDownloadUrl({
        fileId: file.id,
        shareLinkHash,
      });

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
      const result = await getFileDownloadUrl({
        fileId: file.id,
        shareLinkHash,
      });

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
        const result = await getFileDownloadUrl({
          fileId: file.id,
          shareLinkHash,
        });
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
      const result = await getFileDownloadUrl({
        fileId: file.id,
        shareLinkHash,
      });

      if (result.error) {
        setError(result.error);
        return;
      }

      // 암호화된 파일 다운로드
      const response = await fetch(result.downloadUrl);
      const encryptedArrayBuffer = await response.arrayBuffer();

      // 복호화 (올바른 메타데이터 전달)
      const decryptResult = await decryptForPreview(
        encryptedArrayBuffer,
        decryptPassword,
        {
          originalName: file.originalName,
          originalMimetype: file.originalMimetype,
        }
      );

      if (!decryptResult.success || decryptResult.error) {
        setError(decryptResult.error || "복호화에 실패했습니다.");
        return;
      }

      const previewUrl = URL.createObjectURL(decryptResult.blob);
      setPreviewModal({ file, url: previewUrl });
      setDecryptModal(null);
      setDecryptPassword("");
    } catch (err) {
      console.error("미리보기 복호화 오류:", err);
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

        // 총 아이템 수 업데이트
        setTotalItems((prev) => Math.max(0, prev - 1));

        // 새로운 총 페이지 수 계산
        const newTotalItems = Math.max(0, totalItems - 1);
        const newTotalPages = Math.max(
          1,
          Math.ceil(newTotalItems / itemsPerPage)
        );
        setTotalPages(newTotalPages);

        // 현재 페이지가 새로운 총 페이지 수보다 크거나 작으면 유효한 페이지로 이동
        if (currentPage > newTotalPages && newTotalPages > 0) {
          setCurrentPage(newTotalPages);
        } else if (currentPage < 1) {
          setCurrentPage(1);
        }

        showAlert("파일이 성공적으로 삭제되었습니다.");
      } catch (err) {
        setError("파일 삭제 중 오류가 발생했습니다.");
      } finally {
        setActionLoading((prev) => ({ ...prev, [fileId]: false }));
      }
    });
  };

  const handleSort = (column) => {
    setCurrentPage(1); // 정렬 시 첫 페이지로 이동
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
      {/* 경로 표시 (breadcrumbs) */}
      {(directoryId || breadcrumbs.length > 0) && (
        <div className="breadcrumbs mb-4 text-sm">
          <ul>
            <li>
              <Link
                href="/dashboard"
                className="text-blue-700 hover:text-blue-800"
              >
                🏠 내 파일
              </Link>
            </li>
            {breadcrumbs.map((crumb, index) => (
              <li key={crumb.id}>
                <div className="flex items-center gap-1">
                  {index === breadcrumbs.length - 1 ? (
                    <>
                      <span className="  font-medium">{crumb.name}</span>
                      {!crumb.isOwner && (
                        <span className="badge badge-accent badge-xs">
                          👤 공유받음
                        </span>
                      )}
                    </>
                  ) : (
                    <>
                      <Link
                        href={`/directory/${crumb.hash}`}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        {crumb.name}
                      </Link>
                      {!crumb.isOwner && (
                        <span className="badge badge-accent badge-xs ml-1">
                          👤
                        </span>
                      )}
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 검색 필터 */}
      <div className="mb-6">
        {/* 간단 검색 */}
        <div className="flex gap-2 mb-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="파일/폴더 이름으로 검색..."
              className="input input-bordered w-full"
              value={searchQuery}
              onChange={(e) => handleSimpleSearch(e.target.value)}
            />
          </div>
          <button
            className="btn btn-outline"
            onClick={() => setShowAdvancedSearch(!showAdvancedSearch)}
          >
            🔍 고급 검색
          </button>
          {(searchQuery || Object.values(searchFilters).some((v) => v)) && (
            <button className="btn btn-ghost" onClick={resetSearch}>
              ✕ 초기화
            </button>
          )}
        </div>

        {/* 고급 검색 */}
        {showAdvancedSearch && (
          <div className="card bg-base-100 border border-base-300">
            <div className="card-body p-4">
              <h3 className="card-title text-lg mb-4">고급 검색 옵션</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* 이름 검색 */}
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">이름</span>
                  </label>
                  <input
                    type="text"
                    placeholder="파일/폴더 이름"
                    className="input input-bordered input-sm"
                    value={searchFilters.name}
                    onChange={(e) =>
                      setSearchFilters((prev) => ({
                        ...prev,
                        name: e.target.value,
                      }))
                    }
                  />
                </div>

                {/* 날짜 범위 */}
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">생성일 시작</span>
                  </label>
                  <input
                    type="date"
                    className="input input-bordered input-sm"
                    value={searchFilters.dateFrom}
                    onChange={(e) =>
                      setSearchFilters((prev) => ({
                        ...prev,
                        dateFrom: e.target.value,
                      }))
                    }
                  />
                </div>

                <div className="form-control">
                  <label className="label">
                    <span className="label-text">생성일 끝</span>
                  </label>
                  <input
                    type="date"
                    className="input input-bordered input-sm"
                    value={searchFilters.dateTo}
                    onChange={(e) =>
                      setSearchFilters((prev) => ({
                        ...prev,
                        dateTo: e.target.value,
                      }))
                    }
                  />
                </div>

                {/* 파일 크기 */}
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">최소 크기 (MB)</span>
                  </label>
                  <input
                    type="number"
                    placeholder="0"
                    min="0"
                    step="0.1"
                    className="input input-bordered input-sm"
                    value={searchFilters.sizeMin}
                    onChange={(e) =>
                      setSearchFilters((prev) => ({
                        ...prev,
                        sizeMin: e.target.value,
                      }))
                    }
                  />
                </div>

                <div className="form-control">
                  <label className="label">
                    <span className="label-text">최대 크기 (MB)</span>
                  </label>
                  <input
                    type="number"
                    placeholder="무제한"
                    min="0"
                    step="0.1"
                    className="input input-bordered input-sm"
                    value={searchFilters.sizeMax}
                    onChange={(e) =>
                      setSearchFilters((prev) => ({
                        ...prev,
                        sizeMax: e.target.value,
                      }))
                    }
                  />
                </div>

                {/* 파일 타입 자동완성 */}
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">파일 타입</span>
                  </label>
                  <div className="dropdown dropdown-bottom">
                    <input
                      type="text"
                      placeholder="확장자 (예: pdf, jpg)"
                      className="input input-bordered input-sm w-full"
                      value={searchFilters.fileType}
                      onChange={(e) =>
                        setSearchFilters((prev) => ({
                          ...prev,
                          fileType: e.target.value,
                        }))
                      }
                      onFocus={() =>
                        document
                          .getElementById("fileTypeDropdown")
                          .classList.add("dropdown-open")
                      }
                      onBlur={() =>
                        setTimeout(
                          () =>
                            document
                              .getElementById("fileTypeDropdown")
                              .classList.remove("dropdown-open"),
                          150
                        )
                      }
                    />
                    <div
                      id="fileTypeDropdown"
                      className="dropdown-content menu bg-base-100 rounded-box z-[1] w-full p-2 shadow border border-base-300 max-h-40 overflow-y-auto"
                    >
                      {fileTypeOptions
                        .filter((type) =>
                          type
                            .toLowerCase()
                            .includes(searchFilters.fileType.toLowerCase())
                        )
                        .map((type) => (
                          <li key={type}>
                            <button
                              type="button"
                              className="text-left w-full"
                              onClick={() => {
                                setSearchFilters((prev) => ({
                                  ...prev,
                                  fileType: type,
                                }));
                                document
                                  .getElementById("fileTypeDropdown")
                                  .classList.remove("dropdown-open");
                              }}
                            >
                              {type}
                            </button>
                          </li>
                        ))}
                    </div>
                  </div>
                </div>

                {/* 권한 필터 */}
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">권한</span>
                  </label>
                  <select
                    className="select select-bordered select-sm"
                    value={searchFilters.permission}
                    onChange={(e) =>
                      setSearchFilters((prev) => ({
                        ...prev,
                        permission: e.target.value,
                      }))
                    }
                  >
                    <option value="">모든 항목</option>
                    <option value="owner">내가 소유한 항목</option>
                    <option value="shared">공유받은 항목</option>
                  </select>
                </div>
              </div>

              {/* 검색 결과 요약 */}
              {(searchQuery || Object.values(searchFilters).some((v) => v)) && (
                <div className="mt-4 p-3 bg-base-200 rounded-lg">
                  <div className="text-sm">
                    <span className="font-medium">검색 결과:</span>
                    <span className="ml-2">
                      폴더 {filteredDirectories.length}개, 파일{" "}
                      {filteredFiles.length}개
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {filteredDirectories.length === 0 && filteredFiles.length === 0 ? (
        <div className="space-y-4">
          <div className="text-center py-8 bg-base-200 rounded-lg">
            <p className="text-lg">이 디렉토리에 파일이 없습니다.</p>
            <p className="text-gray-500 mt-2">
              파일을 업로드하거나 새 폴더를 만들어보세요.
            </p>
          </div>
          {/* 페이지가 여러 개인 경우 페이지네이터 표시 */}
          {totalPages > 1 && (
            <Paginator
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalItems}
              itemsPerPage={itemsPerPage}
              onPageChange={handlePageChange}
              className="mt-6 mb-20"
            />
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* 대량 액션 컨트롤 */}
          {React.createElement(bulkHandler.BulkActionControls)}

          {/* 전체 다운로드 버튼 */}
          {(filteredDirectories.length > 0 || filteredFiles.length > 0) && (
            <div className="flex justify-end mb-4">
              <button
                onClick={handleBulkDownload}
                className="btn btn-outline btn-sm gap-2"
              >
                📦 전체 다운로드
              </button>
            </div>
          )}

          <div className="overflow-x-auto overflow-y-visible -mx-2 sm:mx-0 relative">
            <p className="text-xs sm:text-sm mb-2">
              각 페이지에는 조회 조건에 맞춰 디렉토리 및 파일이 각각 최대 10개씩
              표시됩니다.
            </p>
            <table className="table w-full text-xs sm:text-sm">
              <thead>
                <tr className="text-xs sm:text-sm">
                  {React.createElement(bulkHandler.SelectAllCheckbox)}
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
                  {mode === "my-uploads" && <th>위치</th>}
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
                  <th>작업</th>
                </tr>
              </thead>
              <tbody>
                {/* 디렉토리 목록 */}
                {filteredDirectories.map((directory) => (
                  <tr
                    key={`dir-${directory.id}`}
                    className="hover cursor-pointer"
                    onClick={(e) => {
                      if (bulkHandler.selectMode) {
                        e.preventDefault();
                        bulkHandler.toggleItemSelection(
                          "directory",
                          directory.id
                        );
                      } else {
                        router.push(
                          `${shareLinkHash ? "/share" : ""}/directory/${
                            directory.hash
                          }`
                        );
                      }
                    }}
                  >
                    {React.createElement(bulkHandler.ItemCheckbox, {
                      type: "directory",
                      id: directory.id,
                      onClick: (e) => e.stopPropagation(),
                    })}
                    <td className="flex items-center gap-2 min-w-0">
                      <span className="text-xl flex-shrink-0">📁</span>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium break-words">
                          {directory.name}
                        </div>
                        {!directory.owner && directory.ownerInfo && (
                          <div className="flex items-center gap-1 mt-1">
                            <div className="badge badge-accent badge-xs sm:badge-sm gap-1 text-xs whitespace-nowrap">
                              <span>👤</span>
                              <span className="truncate max-w-[100px] sm:max-w-none">
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
                      <div className="dropdown dropdown-end dropdown-top">
                        <label
                          tabIndex={0}
                          className="btn btn-ghost btn-xs sm:btn-sm"
                          onClick={(e) => e.stopPropagation()}
                        >
                          ⋮
                        </label>
                        <ul
                          tabIndex={0}
                          className="dropdown-content menu p-2 shadow bg-base-100 rounded-box w-48 sm:w-56 text-xs sm:text-sm z-[9999] absolute"
                        >
                          <li>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                document.activeElement.blur();
                                handleEditDirectory(directory);
                              }}
                              className="text-green-500"
                              disabled={!directory.owner}
                            >
                              ✏️ 수정하기
                            </button>
                          </li>
                          <li>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                document.activeElement.blur();
                                handleShareDirectory(
                                  directory.id,
                                  directory.name
                                );
                              }}
                              className="text-blue-500"
                            >
                              📤 공유하기
                            </button>
                          </li>
                          <li>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                document.activeElement.blur();
                                handleRecursiveDelete(directory.id);
                              }}
                              className="text-red-500"
                              disabled={actionLoading[directory.id]}
                            >
                              🗑️ 삭제 (모든 하위 항목 포함)
                            </button>
                          </li>
                        </ul>
                      </div>
                    </td>
                  </tr>
                ))}

                {/* 파일 목록 */}
                {filteredFiles.map((file) => (
                  <tr
                    key={`file-${file.id}`}
                    className="hover cursor-pointer"
                    onClick={(e) => {
                      if (bulkHandler.selectMode) {
                        e.preventDefault();
                        bulkHandler.toggleItemSelection("file", file.id);
                      } else {
                        router.push(`/file/${file.hash}`);
                      }
                    }}
                  >
                    {React.createElement(bulkHandler.ItemCheckbox, {
                      type: "file",
                      id: file.id,
                      onClick: (e) => e.stopPropagation(),
                    })}
                    <td>
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xl flex-shrink-0">
                          {getFileIcon(file)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="font-medium break-words">
                            {file.originalName}
                          </div>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            {file.isEncrypted && (
                              <div className="badge badge-primary badge-xs sm:badge-sm whitespace-nowrap">
                                🔒 암호화됨
                              </div>
                            )}
                            {file.isPublic && (
                              <div className="badge badge-success badge-xs sm:badge-sm whitespace-nowrap">
                                공개
                              </div>
                            )}
                            {!file.owner && file.ownerInfo && (
                              <div className="badge badge-accent badge-xs sm:badge-sm gap-1 whitespace-nowrap">
                                <span>👤</span>
                                <span className="truncate max-w-[80px] sm:max-w-none">
                                  {file.ownerInfo.name || file.ownerInfo.email}
                                  님이 공유
                                </span>
                              </div>
                            )}
                            {file.owner &&
                              file.parentDirectoryInfo?.owner.id &&
                              file.parentDirectoryInfo?.owner.id !==
                                file.ownerInfo.id && (
                                <div className="badge badge-info badge-xs sm:badge-sm gap-1 whitespace-nowrap">
                                  <span>📁</span>
                                  <span className="truncate max-w-[100px] sm:max-w-none">
                                    {file.parentDirectoryInfo?.owner.name ||
                                      file.parentDirectoryInfo?.owner.email}
                                    님의 {file.parentDirectoryInfo?.name}에
                                    업로드됨
                                  </span>
                                </div>
                              )}
                          </div>
                        </div>
                      </div>
                    </td>
                    {mode === "my-uploads" && (
                      <td>
                        <div className="badge badge-info badge-xs sm:badge-sm gap-1 whitespace-nowrap">
                          <span>📁</span>
                          <span className="truncate max-w-[100px] sm:max-w-none">
                            {file.parentDirectoryInfo?.owner?.name ||
                              file.parentDirectoryInfo?.owner?.email ||
                              "나의"}
                            {file.ownerInfo?.name ? "" : "님의"}{" "}
                            {file.parentDirectoryInfo?.name || "루트 디렉토리"}
                          </span>
                        </div>
                      </td>
                    )}
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
                      <div className="dropdown dropdown-end dropdown-top">
                        <label
                          tabIndex={0}
                          className="btn btn-ghost btn-xs sm:btn-sm"
                          onClick={(e) => e.stopPropagation()}
                        >
                          ⋮
                        </label>
                        <ul
                          tabIndex={0}
                          className="dropdown-content menu p-2 shadow bg-base-100 rounded-box w-48 sm:w-56 text-xs sm:text-sm z-[9999] absolute"
                        >
                          <li>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                document.activeElement.blur();
                                handleDownload(file);
                              }}
                              disabled={actionLoading[file.id]}
                              className={
                                actionLoading[file.id] ? "loading" : ""
                              }
                            >
                              ⬇️ 다운로드
                            </button>
                          </li>
                          {isPreviewable(file) && (
                            <li>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  document.activeElement.blur();
                                  handlePreview(file);
                                }}
                                disabled={actionLoading[file.id]}
                              >
                                👁️ 미리보기
                              </button>
                            </li>
                          )}
                          <li>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                document.activeElement.blur();
                                setShareModal({
                                  isOpen: true,
                                  fileId: file.id,
                                });
                              }}
                            >
                              📤 공유하기
                            </button>
                          </li>
                          <li>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                document.activeElement.blur();
                                handleDelete(file.id);
                              }}
                              className="text-red-500"
                              disabled={actionLoading[file.id]}
                            >
                              🗑️ 삭제
                            </button>
                          </li>
                        </ul>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* 페이지네이터 */}
          <Paginator
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalItems}
            itemsPerPage={itemsPerPage}
            onPageChange={handlePageChange}
            className="mt-6 mb-20"
          />
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
                // eslint-disable-next-line @next/next/no-img-element
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
      <ShareModal
        file={
          shareModal.fileId
            ? files.find((f) => f.id === shareModal.fileId)
            : null
        }
        isOpen={shareModal.isOpen}
        onClose={() => setShareModal({ isOpen: false, fileId: null })}
        onUpdate={() =>
          shareModal.fileId ? updateSingleFile(shareModal.fileId) : fetchData()
        }
      />
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
        onUpdate={() =>
          directoryShareModal.directoryId
            ? updateSingleDirectory(directoryShareModal.directoryId)
            : fetchData()
        }
      />

      {/* 디렉토리 수정 모달 */}
      <EditDirectoryModal
        isOpen={editDirectoryModal.isOpen}
        onClose={() =>
          setEditDirectoryModal({
            isOpen: false,
            directoryId: null,
            directoryName: "",
            directoryDescription: "",
          })
        }
        directoryId={editDirectoryModal.directoryId}
        directoryName={editDirectoryModal.directoryName}
        directoryDescription={editDirectoryModal.directoryDescription}
        onUpdate={(updatedDirectory) => {
          if (updatedDirectory && editDirectoryModal.directoryId) {
            // 업데이트된 디렉토리 정보를 직접 사용
            setDirectories((prevDirs) =>
              prevDirs.map((dir) =>
                dir.id === editDirectoryModal.directoryId
                  ? { ...dir, ...updatedDirectory }
                  : dir
              )
            );
          } else {
            // fallback: 전체 새로고침
            fetchData();
          }
        }}
      />

      {/* 전체 다운로드 모달 */}
      <BulkDownloadModal
        isOpen={bulkDownloadModal.isOpen}
        onClose={() =>
          setBulkDownloadModal({
            isOpen: false,
            directoryId: null,
            directoryName: "",
          })
        }
        directoryId={bulkDownloadModal.directoryId}
        directoryName={bulkDownloadModal.directoryName}
      />

      {/* 삭제 진행 상황 모달 */}
      {React.createElement(bulkHandler.DeleteProgressModal)}

      {/* 선택 다운로드 모달 */}
      <SelectedDownloadModal
        isOpen={bulkHandler.showDownloadModal}
        onClose={() => bulkHandler.setShowDownloadModal(false)}
        selectedFiles={Array.from(selectedItems)
          .filter((item) => item.startsWith("file-"))
          .map((item) => item.replace("file-", ""))}
        onClearSelection={() => {
          bulkHandler.clearSelection();
          bulkHandler.setSelectMode && bulkHandler.setSelectMode(false);
        }}
      />
    </div>
  );
}
