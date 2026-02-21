"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  getFileList,
  getFileDownloadUrl,
  deleteFile,
  getFileDetails,
  getFilesByIds,
  getMyUploadedFiles,
  renameFile,
} from "@/actions/files";
import {
  getDirectoryList,
  getDirectoryDetails,
  deleteDirectoryRecursive,
  getDirectoryBreadcrumbs,
  getAllDescendantDirectoryIds,
} from "@/actions/directories";
import { downloadAndDecrypt, isMediaFile } from "@/lib/crypto/encryption";
import { createPreviewUrl } from "@/lib/downloadUtils";
import DirectoryShareModal from "./directoryShareModal";
import EditDirectoryModal from "./editDirectoryModal";
import BulkDownloadModal from "./bulkDownloadModal";
import ShareModal from "./shareModal";
import BulkActionHandler from "./bulkActionHandler";
import SelectedDownloadModal from "./selectedDownloadModal";
import Paginator from "./paginator";
import SearchFilters from "./fileList/SearchFilters";
import FileStatus from "./fileList/FileStatus";
import FileTable from "./fileList/FileTable";
import FileListModals from "./fileList/FileListModals";
import MoveModal from "./moveModal";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faHouse, faUser, faBox } from "@fortawesome/free-solid-svg-icons";
import useSearchStore from "@/app/stores/searchStore";

export default function FileList({
  directoryId = null,
  refreshTrigger = 0,
  mode = "directory", // "directory" | "my-uploads"
  showDirectories = true,
  shareLinkHash = null,
}) {
  const router = useRouter();
  const { aiResults } = useSearchStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [files, setFiles] = useState([]);
  const [aiFiles, setAiFiles] = useState([]);
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

  // 이동 모달 상태
  const [moveModal, setMoveModal] = useState({
    isOpen: false,
    item: null,
    itemType: null,
    bulkItems: null,
  });

  // 이름 변경 모달 상태
  const [renameModal, setRenameModal] = useState(null);
  const [renameValue, setRenameValue] = useState("");
  const [renameLoading, setRenameLoading] = useState(false);

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
            prevFiles.map((file) => (file.id === fileId ? result.file : file)),
          );
        }
      } catch (error) {
        console.error("파일 업데이트 에러:", error);
        // 실패 시 전체 새로고침으로 폴백
        await fetchData();
      }
    },
    [fetchData],
  );

  // 개별 디렉토리 업데이트 함수 (깜빡임 방지)
  const updateSingleDirectory = useCallback(
    async (directoryId) => {
      try {
        const result = await getDirectoryDetails({ directoryId });
        if (result.success && result.directory) {
          setDirectories((prevDirs) =>
            prevDirs.map((dir) =>
              dir.id === directoryId ? result.directory : dir,
            ),
          );
        }
      } catch (error) {
        console.error("디렉토리 업데이트 에러:", error);
        // 실패 시 전체 새로고침으로 폴백
        await fetchData();
      }
    },
    [fetchData],
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
    onBulkMove: (items) => {
      setMoveModal({
        isOpen: true,
        item: null,
        itemType: null,
        bulkItems: items,
      });
    },
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
      const nameQueryRegex = new RegExp(nameQuery, "i");
      filtered_files = filtered_files.filter(
        (file) =>
          nameQueryRegex.test(file.originalName?.toLowerCase()) ||
          nameQueryRegex.test(file.name?.toLowerCase()),
      );
      filtered_directories = filtered_directories.filter((dir) =>
        nameQueryRegex.test(dir.name?.toLowerCase()),
      );
    }

    // 날짜 필터 (생성일 기준)
    if (searchFilters.dateFrom) {
      const fromDate = new Date(searchFilters.dateFrom);
      filtered_files = filtered_files.filter(
        (file) => new Date(file.createdAt) >= fromDate,
      );
      filtered_directories = filtered_directories.filter(
        (dir) => new Date(dir.createdAt) >= fromDate,
      );
    }

    if (searchFilters.dateTo) {
      const toDate = new Date(searchFilters.dateTo);
      toDate.setHours(23, 59, 59, 999); // 해당 날짜 끝까지
      filtered_files = filtered_files.filter(
        (file) => new Date(file.createdAt) <= toDate,
      );
      filtered_directories = filtered_directories.filter(
        (dir) => new Date(dir.createdAt) <= toDate,
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

    // AI 검색 결과 필터 (활성화된 경우 서버에서 가져온 AI 결과 파일 사용)
    if (aiResults.length > 0) {
      // aiFiles는 이미 디렉토리 필터가 적용된 상태
      const aiFileIds = new Set(aiFiles.map((f) => f.id));
      // 서버에서 가져온 AI 파일과 현재 페이지 파일을 합쳐서 중복 제거
      const currentMatchedFiles = filtered_files.filter((file) =>
        aiFileIds.has(file.id),
      );
      const currentIds = new Set(currentMatchedFiles.map((f) => f.id));
      const additionalFiles = aiFiles.filter((f) => !currentIds.has(f.id));
      filtered_files = [...currentMatchedFiles, ...additionalFiles];
      filtered_directories = [];
    }

    setFilteredFiles(filtered_files);
    setFilteredDirectories(filtered_directories);
  }, [files, directories, searchFilters, aiResults, aiFiles]);

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

    showConfirm(
      "이 디렉토리와 모든 하위 항목을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.",
      async () => {
        setActionLoading((prev) => ({ ...prev, [directoryId]: true }));
        try {
          const result = await deleteDirectoryRecursive(directoryId);

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
      },
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
      directoryName: currentDirectory?.name || "루트 디렉토리",
    });
  };

  // 파일 이동 핸들러
  const handleMoveFile = (file) => {
    setMoveModal({ isOpen: true, item: file, itemType: "file" });
  };

  // 디렉토리 이동 핸들러
  const handleMoveDirectory = (directory) => {
    setMoveModal({ isOpen: true, item: directory, itemType: "directory" });
  };

  // 이동 완료 핸들러
  const handleMoved = () => {
    setMoveModal({
      isOpen: false,
      item: null,
      itemType: null,
      bulkItems: null,
    });
    setSelectedItems(new Set());
    fetchData();
  };

  // 파일 이름 변경 핸들러
  const handleRenameFile = (file) => {
    setRenameModal(file);
    setRenameValue(file.originalName);
  };

  // 파일 이름 변경 실행
  const handleRenameSubmit = async () => {
    if (!renameModal || !renameValue.trim()) return;

    setRenameLoading(true);
    try {
      const result = await renameFile({
        fileId: renameModal.id,
        newName: renameValue.trim(),
      });

      if (result.error) {
        showAlert(result.error);
        return;
      }

      // 파일 목록에서 이름 업데이트
      setFiles((prevFiles) =>
        prevFiles.map((f) =>
          f.id === renameModal.id
            ? { ...f, originalName: result.file.originalName }
            : f,
        ),
      );

      setRenameModal(null);
      setRenameValue("");
      showAlert("파일 이름이 변경되었습니다.");
    } catch (err) {
      showAlert("파일 이름 변경 중 오류가 발생했습니다.");
    } finally {
      setRenameLoading(false);
    }
  };

  // 드래그 앤 드롭 이동 핸들러
  const handleDragDrop = async (dragType, dragId, targetDirId) => {
    try {
      // targetDirId가 현재 디렉토리와 같으면 무시
      if (targetDirId === directoryId) return;

      let result;
      if (dragType === "file") {
        const { moveFile } = await import("@/actions/files");
        result = await moveFile({
          fileId: dragId,
          targetDirectoryId: targetDirId,
        });
      } else {
        const { moveDirectory } = await import("@/actions/directories");
        result = await moveDirectory({
          directoryId: dragId,
          targetParentId: targetDirId,
        });
      }

      if (result.error) {
        showAlert(result.error);
        return;
      }

      showAlert(
        `${dragType === "file" ? "파일" : "디렉토리"}이(가) 이동되었습니다.`,
      );
      await fetchData();
    } catch {
      showAlert("이동 중 오류가 발생했습니다.");
    }
  };

  useEffect(() => {
    fetchData();
  }, [directoryId, refreshTrigger, fetchData]);

  // 파일 타입 옵션 생성
  useEffect(() => {
    generateFileTypeOptions();
  }, [generateFileTypeOptions]);

  // AI 검색 결과에 해당하는 파일 데이터 가져오기
  useEffect(() => {
    if (aiResults.length === 0) {
      setAiFiles([]);
      return;
    }
    const fileIds = aiResults.map((r) => r.fileId).filter(Boolean);
    if (fileIds.length === 0) {
      setAiFiles([]);
      return;
    }
    getFilesByIds(fileIds).then(async (result) => {
      if (!result.files) {
        setAiFiles([]);
        return;
      }
      // 루트 디렉토리가 아닌 경우, 현재 디렉토리와 하위 디렉토리 파일만 필터
      if (directoryId) {
        const descResult = await getAllDescendantDirectoryIds(directoryId);
        const allowedDirs = new Set([directoryId, ...(descResult.ids || [])]);
        setAiFiles(result.files.filter((f) => allowedDirs.has(f.parentDirectory)));
      } else {
        setAiFiles(result.files);
      }
    }).catch(() => {
      setAiFiles([]);
    });
  }, [aiResults, directoryId]);

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
        asPreview: true,
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
        metadata,
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
          asPreview: true,
        });
        if (result.error) {
          setError(result.error);
          return;
        }
        const isPdfOrText =
          file.mimetype?.startsWith("application/pdf") ||
          file.originalMimetype?.startsWith("application/pdf") ||
          file.mimetype?.startsWith("text/") ||
          file.originalMimetype?.startsWith("text/") ||
          file.originalName?.endsWith(".ejtxt");
        const previewResult = await createPreviewUrl({
          downloadUrl: result.downloadUrl,
          forceBlob: isPdfOrText,
        });

        if (previewResult.error) {
          throw new Error(previewResult.error);
        }

        setPreviewModal({ file, url: previewResult.url });
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
        asPreview: true,
      });

      if (result.error) {
        setError(result.error);
        return;
      }

      const previewResult = await createPreviewUrl({
        downloadUrl: result.downloadUrl,
        isEncrypted: true,
        password: decryptPassword,
        metadata: {
          originalName: file.originalName,
          originalMimetype: file.originalMimetype,
        },
      });

      if (previewResult.error) {
        setError(previewResult.error || "복호화에 실패했습니다.");
        return;
      }

      setPreviewModal({
        file,
        url: previewResult.url,
        encryptionPassword: decryptPassword,
      });
      setDecryptModal(null);
      setDecryptPassword("");
    } catch (err) {
      console.error("미리보기 복호화 오류:", err);
      setError(
        "미리보기 생성 중 오류가 발생했습니다. 복호화 키가 올바른지 확인해주세요.",
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
          Math.ceil(newTotalItems / itemsPerPage),
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

  const isPreviewable = (file) => {
    const mimetype = file.isEncrypted ? file.originalMimetype : file.mimetype;
    return isMediaFile(mimetype);
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
                <FontAwesomeIcon icon={faHouse} /> 내 파일
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
                          <FontAwesomeIcon icon={faUser} /> 공유받음
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
                          <FontAwesomeIcon icon={faUser} />
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
      <FileStatus />
      <SearchFilters
        searchQuery={searchQuery}
        onSimpleSearch={handleSimpleSearch}
        showAdvancedSearch={showAdvancedSearch}
        onToggleAdvancedSearch={() =>
          setShowAdvancedSearch(!showAdvancedSearch)
        }
        searchFilters={searchFilters}
        onUpdateFilter={(key, value) =>
          setSearchFilters((prev) => ({ ...prev, [key]: value }))
        }
        onResetSearch={resetSearch}
        fileTypeOptions={fileTypeOptions}
        filteredDirectories={filteredDirectories}
        filteredFiles={filteredFiles}
        aiFiles={aiFiles}
      />

      {filteredDirectories.length === 0 && filteredFiles.length === 0 ? (
        <div className="space-y-4">
          <div className="text-center py-8 bg-base-200 rounded-lg">
            {aiResults.length > 0 ? (
              <>
                <p className="text-lg">AI 검색 결과가 현재 목록에 없습니다.</p>
                <p className="text-gray-500 mt-2">
                  다른 페이지에 결과가 있을 수 있습니다.
                </p>
              </>
            ) : (
              <>
                <p className="text-lg">이 디렉토리에 파일이 없습니다.</p>
                <p className="text-gray-500 mt-2">
                  파일을 업로드하거나 새 디렉토리를 만들어보세요.
                </p>
              </>
            )}
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
                <FontAwesomeIcon icon={faBox} /> 전체 다운로드
              </button>
            </div>
          )}

          <FileTable
            filteredDirectories={filteredDirectories}
            filteredFiles={filteredFiles}
            bulkHandler={bulkHandler}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSort={handleSort}
            mode={mode}
            shareLinkHash={shareLinkHash}
            actionLoading={actionLoading}
            onDownload={handleDownload}
            onPreview={handlePreview}
            onDelete={handleDelete}
            onShareFile={(fileId) => setShareModal({ isOpen: true, fileId })}
            onEditDirectory={handleEditDirectory}
            onShareDirectory={handleShareDirectory}
            onRecursiveDelete={handleRecursiveDelete}
            onMoveFile={handleMoveFile}
            onMoveDirectory={handleMoveDirectory}
            onDragDrop={handleDragDrop}
            currentDirectoryId={directoryId}
            onRenameFile={handleRenameFile}
          />
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
      {/* 모달들 */}
      <FileListModals
        decryptModal={decryptModal}
        decryptPassword={decryptPassword}
        setDecryptPassword={setDecryptPassword}
        setDecryptModal={setDecryptModal}
        actionLoading={actionLoading}
        onEncryptedDownload={handleEncryptedDownload}
        onEncryptedPreview={handleEncryptedPreview}
        previewModal={previewModal}
        setPreviewModal={setPreviewModal}
        shareModal={shareModal}
        setShareModal={setShareModal}
        files={files}
        updateSingleFile={updateSingleFile}
        fetchData={fetchData}
        alertModal={alertModal}
        setAlertModal={setAlertModal}
        confirmModal={confirmModal}
        setConfirmModal={setConfirmModal}
        directoryShareModal={directoryShareModal}
        setDirectoryShareModal={setDirectoryShareModal}
        updateSingleDirectory={updateSingleDirectory}
        editDirectoryModal={editDirectoryModal}
        setEditDirectoryModal={setEditDirectoryModal}
        setDirectories={setDirectories}
        bulkDownloadModal={bulkDownloadModal}
        setBulkDownloadModal={setBulkDownloadModal}
        bulkHandler={bulkHandler}
        selectedItems={selectedItems}
        ShareModal={ShareModal}
        DirectoryShareModal={DirectoryShareModal}
        EditDirectoryModal={EditDirectoryModal}
        BulkDownloadModal={BulkDownloadModal}
        SelectedDownloadModal={SelectedDownloadModal}
        renameModal={renameModal}
        setRenameModal={setRenameModal}
        renameValue={renameValue}
        setRenameValue={setRenameValue}
        onRenameSubmit={handleRenameSubmit}
        renameLoading={renameLoading}
      />
      {/* 이동 모달 */}
      <MoveModal
        isOpen={moveModal.isOpen}
        onClose={() =>
          setMoveModal({
            isOpen: false,
            item: null,
            itemType: null,
            bulkItems: null,
          })
        }
        item={moveModal.item}
        itemType={moveModal.itemType}
        onMoved={handleMoved}
        bulkItems={moveModal.bulkItems}
        files={filteredFiles}
        directories={filteredDirectories}
      />
    </div>
  );
}
