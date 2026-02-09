"use client";

import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMagnifyingGlass, faXmark } from "@fortawesome/free-solid-svg-icons";

export default function SearchFilters({
  searchQuery,
  onSimpleSearch,
  showAdvancedSearch,
  onToggleAdvancedSearch,
  searchFilters,
  onUpdateFilter,
  onResetSearch,
  fileTypeOptions,
  filteredDirectories,
  filteredFiles,
}) {
  return (
    <div className="mb-6">
      {/* 간단 검색 */}
      <div className="flex gap-2 mb-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="파일/디렉토리 이름으로 검색..."
            className="input input-bordered w-full"
            value={searchQuery}
            onChange={(e) => onSimpleSearch(e.target.value)}
          />
        </div>
        <button
          className="btn btn-outline"
          onClick={onToggleAdvancedSearch}
        >
          <FontAwesomeIcon icon={faMagnifyingGlass} /> 고급 검색
        </button>
        {(searchQuery || Object.values(searchFilters).some((v) => v)) && (
          <button className="btn btn-ghost" onClick={onResetSearch}>
            <FontAwesomeIcon icon={faXmark} /> 초기화
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
                  placeholder="파일/디렉토리 이름"
                  className="input input-bordered input-sm"
                  value={searchFilters.name}
                  onChange={(e) => onUpdateFilter("name", e.target.value)}
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
                  onChange={(e) => onUpdateFilter("dateFrom", e.target.value)}
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
                  onChange={(e) => onUpdateFilter("dateTo", e.target.value)}
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
                  onChange={(e) => onUpdateFilter("sizeMin", e.target.value)}
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
                  onChange={(e) => onUpdateFilter("sizeMax", e.target.value)}
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
                      onUpdateFilter("fileType", e.target.value)
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
                              onUpdateFilter("fileType", type);
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

              {/* 권한 필터 */}
              <div className="form-control">
                <label className="label">
                  <span className="label-text">권한</span>
                </label>
                <select
                  className="select select-bordered select-sm"
                  value={searchFilters.permission}
                  onChange={(e) =>
                    onUpdateFilter("permission", e.target.value)
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
                    디렉토리 {filteredDirectories.length}개, 파일{" "}
                    {filteredFiles.length}개
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
