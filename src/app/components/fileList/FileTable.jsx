"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { formatBytes, formatDate, getFileIcon, isPreviewable } from "./utils";

export default function FileTable({
  filteredDirectories,
  filteredFiles,
  bulkHandler,
  sortBy,
  sortOrder,
  onSort,
  mode,
  shareLinkHash,
  actionLoading,
  onDownload,
  onPreview,
  onDelete,
  onShareFile,
  onEditDirectory,
  onShareDirectory,
  onRecursiveDelete,
}) {
  const router = useRouter();

  return (
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
              onClick={() => onSort("name")}
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
              onClick={() => onSort("size")}
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
              onClick={() => onSort("mimetype")}
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
              onClick={() => onSort("createdAt")}
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
          {filteredDirectories.map((directory, index) => (
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
                <div
                  className={`dropdown dropdown-end ${
                    index === 0 ? "dropdown-bottom" : "dropdown-top"
                  }`}
                >
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
                          onEditDirectory(directory);
                        }}
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
                          onShareDirectory(
                            directory.id,
                            directory.name
                          );
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
                          onRecursiveDelete(directory.id);
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
          {filteredFiles.map((file, index) => (
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
                      {file.isWebGLBuild && (
                        <div className="badge badge-secondary badge-xs sm:badge-sm whitespace-nowrap">
                          🎮 WebGL 게임
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
                <div
                  className={`dropdown dropdown-end ${
                    filteredDirectories.length === 0 && index === 0
                      ? "dropdown-bottom"
                      : "dropdown-top"
                  }`}
                >
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
                          onDownload(file);
                        }}
                        disabled={actionLoading[file.id]}
                        className={
                          actionLoading[file.id] ? "loading" : ""
                        }
                      >
                        ⬇️ 다운로드
                      </button>
                    </li>
                    {file.isWebGLBuild && (
                      <li>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            document.activeElement.blur();
                            router.push(`/play/${file.hash}`);
                          }}
                        >
                          🎮 게임 플레이
                        </button>
                      </li>
                    )}
                    {isPreviewable(file) && (
                      <li>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            document.activeElement.blur();
                            onPreview(file);
                          }}
                          disabled={actionLoading[file.id]}
                        >
                          👁️ 미리보기
                        </button>
                      </li>
                    )}
                    {file.originalName.endsWith(".ejtxt") && (
                      <li>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            document.activeElement.blur();
                            onPreview(file);
                          }}
                          disabled={actionLoading[file.id]}
                        >
                          ✍️ 편집하기
                        </button>
                      </li>
                    )}
                    <li>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          document.activeElement.blur();
                          onShareFile(file.id);
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
                          onDelete(file.id);
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
  );
}
