"use client";

import React, { useState, useEffect, useCallback } from "react";

export default function SearchComponent({
  // Configuration props
  enableAdvancedSearch = true,
  showPermissionFilter = true,
  
  // Data props
  files = [],
  directories = [],
  
  // Callback props
  onSearchChange,
  onFilteredResultsChange,
  
  // UI customization props
  placeholder = "파일/폴더 이름으로 검색...",
  className = "",
}) {
  // Search states
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

  // File type autocomplete options generation
  const generateFileTypeOptions = useCallback(() => {
    const types = new Set();
    files.forEach((file) => {
      if (file.originalName || file.name) {
        const fileName = file.originalName || file.name;
        const extension = fileName.split(".").pop()?.toLowerCase();
        if (extension) {
          types.add(extension);
        }
      }
    });
    setFileTypeOptions(Array.from(types).sort());
  }, [files]);

  // Search filter application
  const applySearchFilters = useCallback(() => {
    let filteredFiles = [...files];
    let filteredDirectories = [...directories];

    // Name filter
    if (searchFilters.name) {
      const nameQuery = searchFilters.name.toLowerCase();
      filteredFiles = filteredFiles.filter(
        (file) =>
          (file.originalName?.toLowerCase().includes(nameQuery) ||
           file.name?.toLowerCase().includes(nameQuery))
      );
      filteredDirectories = filteredDirectories.filter((dir) =>
        dir.name?.toLowerCase().includes(nameQuery)
      );
    }

    // Date range filter (creation date)
    if (searchFilters.dateFrom) {
      const fromDate = new Date(searchFilters.dateFrom);
      filteredFiles = filteredFiles.filter(
        (file) => new Date(file.createdAt || file.uploadedAt) >= fromDate
      );
      filteredDirectories = filteredDirectories.filter(
        (dir) => new Date(dir.createdAt) >= fromDate
      );
    }

    if (searchFilters.dateTo) {
      const toDate = new Date(searchFilters.dateTo);
      toDate.setHours(23, 59, 59, 999); // End of day
      filteredFiles = filteredFiles.filter(
        (file) => new Date(file.createdAt || file.uploadedAt) <= toDate
      );
      filteredDirectories = filteredDirectories.filter(
        (dir) => new Date(dir.createdAt) <= toDate
      );
    }

    // File size filter (files only)
    if (searchFilters.sizeMin) {
      const minSize = parseFloat(searchFilters.sizeMin) * 1024 * 1024; // MB to bytes
      filteredFiles = filteredFiles.filter((file) => (file.size || 0) >= minSize);
    }

    if (searchFilters.sizeMax) {
      const maxSize = parseFloat(searchFilters.sizeMax) * 1024 * 1024; // MB to bytes
      filteredFiles = filteredFiles.filter((file) => (file.size || 0) <= maxSize);
    }

    // File type filter
    if (searchFilters.fileType) {
      const typeQuery = searchFilters.fileType.toLowerCase();
      filteredFiles = filteredFiles.filter((file) => {
        const fileName = file.originalName || file.name || "";
        const extension = fileName.split(".").pop()?.toLowerCase();
        return extension === typeQuery;
      });
    }

    // Permission filter (if enabled)
    if (showPermissionFilter && searchFilters.permission && searchFilters.permission !== "all") {
      if (searchFilters.permission === "owner") {
        filteredFiles = filteredFiles.filter((file) => file.owner);
        filteredDirectories = filteredDirectories.filter((dir) => dir.owner);
      } else if (searchFilters.permission === "shared") {
        filteredFiles = filteredFiles.filter((file) => !file.owner);
        filteredDirectories = filteredDirectories.filter((dir) => !dir.owner);
      }
    }

    return { filteredFiles, filteredDirectories };
  }, [files, directories, searchFilters, showPermissionFilter]);

  // Reset search function
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

  // Simple search handler (name only)
  const handleSimpleSearch = (query) => {
    setSearchQuery(query);
    setSearchFilters((prev) => ({ ...prev, name: query }));
  };

  // Generate file type options when files change
  useEffect(() => {
    generateFileTypeOptions();
  }, [generateFileTypeOptions]);

  // Apply filters and notify parent when filters change
  useEffect(() => {
    const { filteredFiles, filteredDirectories } = applySearchFilters();
    
    // Notify parent component about search state and filtered results
    if (onSearchChange) {
      onSearchChange({
        searchQuery,
        searchFilters,
        showAdvancedSearch,
      });
    }

    if (onFilteredResultsChange) {
      onFilteredResultsChange({
        filteredFiles,
        filteredDirectories,
      });
    }
  }, [searchQuery, searchFilters, showAdvancedSearch, applySearchFilters, onSearchChange, onFilteredResultsChange]);

  // Get current filtered results for display
  const { filteredFiles: currentFilteredFiles, filteredDirectories: currentFilteredDirectories } = applySearchFilters();

  const hasActiveFilters = searchQuery || Object.values(searchFilters).some((v) => v);

  return (
    <div className={`mb-6 ${className}`}>
      {/* Simple search */}
      <div className="flex gap-2 mb-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder={placeholder}
            className="input input-bordered w-full"
            value={searchQuery}
            onChange={(e) => handleSimpleSearch(e.target.value)}
          />
        </div>
        {enableAdvancedSearch && (
          <button
            className="btn btn-outline"
            onClick={() => setShowAdvancedSearch(!showAdvancedSearch)}
          >
            🔍 고급 검색
          </button>
        )}
        {hasActiveFilters && (
          <button className="btn btn-ghost" onClick={resetSearch}>
            ✕ 초기화
          </button>
        )}
      </div>

      {/* Advanced search */}
      {enableAdvancedSearch && showAdvancedSearch && (
        <div className="card bg-base-100 border border-base-300">
          <div className="card-body p-4">
            <h3 className="card-title text-lg mb-4">고급 검색 옵션</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Name search */}
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

              {/* Date range */}
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

              {/* File size */}
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

              {/* File type autocomplete */}
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
                        ?.classList.add("dropdown-open")
                    }
                    onBlur={() =>
                      setTimeout(
                        () =>
                          document
                            .getElementById("fileTypeDropdown")
                            ?.classList.remove("dropdown-open"),
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
                                ?.classList.remove("dropdown-open");
                            }}
                          >
                            {type}
                          </button>
                        </li>
                      ))}
                  </div>
                </div>
              </div>

              {/* Permission filter */}
              {showPermissionFilter && (
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
              )}
            </div>

            {/* Search results summary */}
            {hasActiveFilters && (
              <div className="mt-4 p-3 bg-base-200 rounded-lg">
                <div className="text-sm">
                  <span className="font-medium">검색 결과:</span>
                  <span className="ml-2">
                    폴더 {currentFilteredDirectories.length}개, 파일 {currentFilteredFiles.length}개
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}