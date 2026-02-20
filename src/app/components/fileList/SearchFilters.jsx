"use client";

import React, { useEffect, useTransition, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faMagnifyingGlass,
  faXmark,
  faRobot,
  faSpinner,
} from "@fortawesome/free-solid-svg-icons";
import useSearchStore from "@/app/stores/searchStore";
import { aiSearch, aiTopics } from "@/app/actions/ai";

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
  const {
    query: aiQuery,
    setQuery: setAiQuery,
    fileTypes: selectedFileTypes,
    setFileTypes,
    topics: selectedTopics,
    setTopics,
    aiResults,
    setAiResults,
    isLoading,
    setIsLoading,
    resetSearch: resetAiSearch,
  } = useSearchStore();

  const [isPending, startTransition] = useTransition();
  const [showAiSearch, setShowAiSearch] = useState(false);
  const [availableTopics, setAvailableTopics] = useState([]);
  const [aiError, setAiError] = useState("");
  const [showAllFileTypes, setShowAllFileTypes] = useState(false);

  // 토픽 목록 동적 로드
  useEffect(() => {
    if (!showAiSearch) return;
    aiTopics().then((result) => {
      if (result.success) setAvailableTopics(result.topics);
    });
  }, [showAiSearch]);

  const handleAiSearch = () => {
    if (!aiQuery.trim()) return;
    setAiError("");
    setIsLoading(true);
    startTransition(async () => {
      const filters = {};
      if (selectedFileTypes.length > 0) filters.fileTypes = selectedFileTypes;
      if (selectedTopics.length > 0) filters.topics = selectedTopics;

      const result = await aiSearch(aiQuery, filters);
      setIsLoading(false);
      if (result.error) {
        setAiError(result.error);
        setAiResults([]);
      } else {
        setAiResults(result.results);
      }
    });
  };

  const handleAiReset = () => {
    resetAiSearch();
    setAiError("");
    setAvailableTopics([]);
  };

  const toggleFileType = (type) => {
    setFileTypes(
      selectedFileTypes.includes(type)
        ? selectedFileTypes.filter((t) => t !== type)
        : [...selectedFileTypes, type]
    );
  };

  const toggleTopic = (topic) => {
    setTopics(
      selectedTopics.includes(topic)
        ? selectedTopics.filter((t) => t !== topic)
        : [...selectedTopics, topic]
    );
  };

  const isAiSearchActive = aiResults.length > 0 || aiQuery;

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
        <button
          className={`btn ${showAiSearch ? "btn-primary" : "btn-outline"}`}
          onClick={() => setShowAiSearch((v) => !v)}
          title="AI 벡터 검색"
        >
          <FontAwesomeIcon icon={faRobot} /> AI 검색
        </button>
        {(searchQuery || Object.values(searchFilters).some((v) => v)) && (
          <button className="btn btn-ghost" onClick={onResetSearch}>
            <FontAwesomeIcon icon={faXmark} /> 초기화
          </button>
        )}
      </div>

      {/* AI 검색 패널 */}
      {showAiSearch && (
        <div className="card bg-base-100 border border-primary mb-4">
          <div className="card-body p-4">
            <h3 className="card-title text-lg mb-3 text-primary">
              <FontAwesomeIcon icon={faRobot} /> AI 벡터 검색
            </h3>

            {/* 검색 입력 */}
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                placeholder="자연어로 검색... (예: 지난달 재무 보고서)"
                className="input input-bordered flex-1"
                value={aiQuery}
                onChange={(e) => setAiQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAiSearch()}
              />
              <button
                className="btn btn-primary"
                onClick={handleAiSearch}
                disabled={!aiQuery.trim() || isLoading || isPending}
              >
                {isLoading || isPending ? (
                  <FontAwesomeIcon icon={faSpinner} className="animate-spin" />
                ) : (
                  <FontAwesomeIcon icon={faMagnifyingGlass} />
                )}
                검색
              </button>
              {isAiSearchActive && (
                <button className="btn btn-ghost" onClick={handleAiReset}>
                  <FontAwesomeIcon icon={faXmark} /> 초기화
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 파일 타입 필터 */}
              {fileTypeOptions.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">파일 타입</p>
                  <div className="flex flex-wrap gap-2">
                    {(showAllFileTypes ? fileTypeOptions : fileTypeOptions.slice(0, 10)).map((type) => (
                      <label key={type} className="flex items-center gap-1 cursor-pointer">
                        <input
                          type="checkbox"
                          className="checkbox checkbox-xs checkbox-primary"
                          checked={selectedFileTypes.includes(type)}
                          onChange={() => toggleFileType(type)}
                        />
                        <span className="text-sm">{type}</span>
                      </label>
                    ))}
                    {fileTypeOptions.length > 10 && (
                      <button
                        className="text-xs text-primary underline"
                        onClick={() => setShowAllFileTypes((v) => !v)}
                      >
                        {showAllFileTypes ? "접기" : `+${fileTypeOptions.length - 10}개 더 보기`}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* 토픽 필터 */}
              {availableTopics.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">토픽</p>
                  <div className="flex flex-wrap gap-2">
                    {availableTopics.map((topic) => (
                      <button
                        key={topic}
                        className={`badge badge-outline cursor-pointer ${
                          selectedTopics.includes(topic)
                            ? "badge-primary"
                            : ""
                        }`}
                        onClick={() => toggleTopic(topic)}
                      >
                        {topic}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 오류 메시지 */}
            {aiError && (
              <div className="alert alert-error mt-3 py-2 text-sm">
                {aiError}
              </div>
            )}

            {/* AI 검색 결과 */}
            {aiResults.length > 0 && (
              <div className="mt-3">
                <p className="text-sm font-medium mb-2">
                  AI 검색 결과 ({aiResults.length}개)
                </p>
                <div className="flex flex-col gap-2 max-h-60 overflow-y-auto">
                  {aiResults.map((item, idx) => (
                    <div
                      key={item.fileId ?? idx}
                      className="flex items-center justify-between p-2 rounded bg-base-200 text-sm"
                    >
                      <span className="truncate flex-1">{item.filename ?? item.fileId}</span>
                      {item.score != null && (
                        <span className="badge badge-outline badge-sm ml-2">
                          {(item.score * 100).toFixed(0)}%
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 검색 결과 없음 */}
            {!isLoading && !isPending && aiQuery && aiResults.length === 0 && !aiError && (
              <p className="text-sm text-base-content/50 mt-3">
                검색 결과가 없습니다.
              </p>
            )}
          </div>
        </div>
      )}

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
