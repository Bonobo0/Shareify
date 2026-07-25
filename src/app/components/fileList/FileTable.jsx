"use client";

import React, { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { formatBytes, formatDate, getFileIcon, isPreviewable } from "./utils";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faFolderOpen,
  faFolder,
  faUser,
  faPenToSquare,
  faUpload,
  faTrash,
  faLock,
  faDownload,
  faEye,
  faGamepad,
  faSortUp,
  faSortDown,
  faICursor,
} from "@fortawesome/free-solid-svg-icons";

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
  onMoveFile,
  onMoveDirectory,
  onDragDrop,
  currentDirectoryId,
  onRenameFile,
}) {
  const router = useRouter();
  const [dragOverId, setDragOverId] = useState(null);

  const handleDragStart = useCallback((e, type, id, name) => {
    e.dataTransfer.setData(
      "application/shareify-drag",
      JSON.stringify({ type, id }),
    );
    e.dataTransfer.effectAllowed = "move";
    // 드래그 이미지 텍스트
    const ghost = document.createElement("div");
    ghost.className = "badge badge-primary badge-lg";
    ghost.textContent = `${type === "file" ? "파일" : "폴더"} ${name}`;
    ghost.style.position = "absolute";
    ghost.style.top = "-1000px";
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 0, 0);
    setTimeout(() => document.body.removeChild(ghost), 0);
  }, []);

  const handleDragOver = useCallback((e, dirId) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
    setDragOverId(dirId);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setDragOverId(null);
  }, []);

  const handleDrop = useCallback(
    (e, targetDirId) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOverId(null);

      try {
        const data = JSON.parse(
          e.dataTransfer.getData("application/shareify-drag"),
        );
        if (!data || !data.type || !data.id) return;

        // 자기 자신에게 드롭 방지
        if (data.type === "directory" && data.id === targetDirId) return;

        if (onDragDrop) {
          onDragDrop(data.type, data.id, targetDirId);
        }
      } catch {
        // 드래그 데이터 파싱 실패 - 무시
      }
    },
    [onDragDrop],
  );

  return (
    <div className="-mx-2 sm:mx-0">
      <p className="text-xs sm:text-sm mb-2">
        각 페이지에는 조회 조건에 맞춰 디렉토리 및 파일이 각각 최대 10개씩
        표시됩니다.
      </p>

      {/* 현재 디렉토리/루트 드롭 영역 */}
      {onDragDrop && (
        <div
          className={`border-2 border-dashed rounded-lg mb-2 py-2 text-center text-xs opacity-0 transition-all
            ${dragOverId === "__current__" ? "border-primary bg-primary/10 opacity-100" : "border-transparent"}
          `}
          onDragOver={(e) => handleDragOver(e, "__current__")}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, currentDirectoryId || null)}
          style={{ minHeight: dragOverId ? "36px" : "0px" }}
        >
          {dragOverId === "__current__" && (
            <span className="text-primary font-medium">
              <FontAwesomeIcon icon={faFolderOpen} /> 현재 디렉토리에 놓기
            </span>
          )}
        </div>
      )}

      <div className="overflow-x-auto">
      <table className="table w-full text-xs sm:text-sm">
        <thead>
          <tr className="text-xs sm:text-sm">
            {React.createElement(bulkHandler.SelectAllCheckbox)}
            <th className="cursor-pointer" onClick={() => onSort("name")}>
              이름
              {sortBy === "name" && (
                <span className="ml-1">{sortOrder === "asc" ? <FontAwesomeIcon icon={faSortUp} /> : <FontAwesomeIcon icon={faSortDown} />}</span>
              )}
            </th>
            {mode === "my-uploads" && <th>위치</th>}
            <th className="cursor-pointer" onClick={() => onSort("size")}>
              크기
              {sortBy === "size" && (
                <span className="ml-1">{sortOrder === "asc" ? <FontAwesomeIcon icon={faSortUp} /> : <FontAwesomeIcon icon={faSortDown} />}</span>
              )}
            </th>
            <th className="cursor-pointer" onClick={() => onSort("mimetype")}>
              유형
              {sortBy === "mimetype" && (
                <span className="ml-1">{sortOrder === "asc" ? <FontAwesomeIcon icon={faSortUp} /> : <FontAwesomeIcon icon={faSortDown} />}</span>
              )}
            </th>
            <th className="cursor-pointer" onClick={() => onSort("createdAt")}>
              생성 일시
              {sortBy === "createdAt" && (
                <span className="ml-1">{sortOrder === "asc" ? <FontAwesomeIcon icon={faSortUp} /> : <FontAwesomeIcon icon={faSortDown} />}</span>
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
              className={`hover cursor-pointer transition-colors ${
                dragOverId === directory.id
                  ? "bg-primary/20 outline outline-2 outline-primary"
                  : ""
              }`}
              draggable={!shareLinkHash && directory.owner}
              onDragStart={(e) =>
                handleDragStart(e, "directory", directory.id, directory.name)
              }
              onDragOver={(e) => handleDragOver(e, directory.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, directory.id)}
              onClick={(e) => {
                if (bulkHandler.selectMode) {
                  e.preventDefault();
                  bulkHandler.toggleItemSelection("directory", directory.id);
                } else {
                  router.push(
                    `${shareLinkHash ? "/share" : ""}/directory/${
                      directory.hash
                    }`,
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
                <span className="text-xl flex-shrink-0"><FontAwesomeIcon icon={faFolder} /></span>
                <div className="min-w-0 flex-1">
                  <div className="font-medium break-words">
                    {directory.name}
                  </div>
                  {!directory.owner && directory.ownerInfo && (
                    <div className="mt-1">
                      <span className="badge-neutral inline-flex max-w-full items-center gap-1 truncate text-[10px] sm:text-xs">
                        <FontAwesomeIcon icon={faUser} className="shrink-0" />
                        <span className="truncate">
                          {directory.ownerInfo.name || directory.ownerInfo.email} 님이 공유
                        </span>
                      </span>
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
                    index >= filteredDirectories.length - 2
                      ? "dropdown-top"
                      : "dropdown-bottom"
                  }`}
                >
                  <label
                    tabIndex={0}
                    className="btn btn-ghost btn-xs sm:btn-sm flex items-center justify-center"
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
                        <FontAwesomeIcon icon={faPenToSquare} /> 수정하기
                      </button>
                    </li>
                    <li>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          document.activeElement.blur();
                          onShareDirectory(directory.id, directory.name);
                        }}
                      >
                        <FontAwesomeIcon icon={faUpload} /> 공유하기
                      </button>
                    </li>
                    {onMoveDirectory && (
                      <li>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            document.activeElement.blur();
                            onMoveDirectory(directory);
                          }}
                          disabled={!directory.owner}
                        >
                          <FontAwesomeIcon icon={faFolder} /> 이동
                        </button>
                      </li>
                    )}
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
                        <FontAwesomeIcon icon={faTrash} /> 삭제 (모든 하위 항목 포함)
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
              draggable={!shareLinkHash && file.owner}
              onDragStart={(e) =>
                handleDragStart(e, "file", file.id, file.originalName)
              }
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
                    <div className="mt-1 flex flex-wrap items-center gap-1">
                      {file.isEncrypted && (
                        <span className="badge-brand inline-flex items-center gap-0.5 text-[10px] sm:text-xs">
                          <FontAwesomeIcon icon={faLock} className="shrink-0" />
                          <span className="hidden sm:inline">암호화됨</span>
                          <span className="sm:hidden">암호</span>
                        </span>
                      )}
                      {file.isWebGLBuild && (
                        <span className="badge-warning inline-flex items-center gap-0.5 text-[10px] sm:text-xs">
                          <FontAwesomeIcon icon={faGamepad} className="shrink-0" />
                          <span className="hidden sm:inline">WebGL 게임</span>
                          <span className="sm:hidden">WebGL</span>
                        </span>
                      )}
                      {file.isPublic && (
                        <span className="badge-success inline-flex items-center gap-0.5 text-[10px] sm:text-xs">
                          공개
                        </span>
                      )}
                      {!file.owner && file.ownerInfo && (
                        <span className="badge-neutral inline-flex max-w-[120px] items-center gap-0.5 truncate text-[10px] sm:max-w-[200px] sm:text-xs">
                          <FontAwesomeIcon icon={faUser} className="shrink-0" />
                          <span className="truncate">
                            {file.ownerInfo.name || file.ownerInfo.email} 님이 공유
                          </span>
                        </span>
                      )}
                      {file.owner &&
                        file.parentDirectoryInfo?.owner.id &&
                        file.parentDirectoryInfo?.owner.id !==
                          file.ownerInfo.id && (
                          <span className="badge-neutral inline-flex max-w-[120px] items-center gap-0.5 truncate text-[10px] sm:max-w-[200px] sm:text-xs">
                            <FontAwesomeIcon icon={faFolder} className="shrink-0" />
                            <span className="truncate">
                              {file.parentDirectoryInfo?.owner.name ||
                                file.parentDirectoryInfo?.owner.email}
                              님의 {file.parentDirectoryInfo?.name}
                            </span>
                          </span>
                        )}
                    </div>
                  </div>
                </div>
              </td>
              {mode === "my-uploads" && (
                <td>
                  <div className="badge badge-info badge-xs sm:badge-sm gap-1 whitespace-nowrap">
                    <span><FontAwesomeIcon icon={faFolder} /></span>
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
                {formatBytes(file.isEncrypted ? file.originalSize : file.size)}
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
                    index >= filteredFiles.length - 2
                      ? "dropdown-top"
                      : "dropdown-bottom"
                  }`}
                >
                  <label
                    tabIndex={0}
                    className="btn btn-ghost btn-xs sm:btn-sm flex items-center justify-center"
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
                        className={actionLoading[file.id] ? "loading" : ""}
                      >
                        <FontAwesomeIcon icon={faDownload} /> 다운로드
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
                          <FontAwesomeIcon icon={faGamepad} /> 게임 플레이
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
                          <FontAwesomeIcon icon={faEye} /> 미리보기
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
                          <FontAwesomeIcon icon={faPenToSquare} /> 편집하기
                        </button>
                      </li>
                    )}
                    {onRenameFile && (
                      <li>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            document.activeElement.blur();
                            onRenameFile(file);
                          }}
                          disabled={!file.owner}
                        >
                          <FontAwesomeIcon icon={faICursor} /> 이름 변경
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
                        <FontAwesomeIcon icon={faUpload} /> 공유하기
                      </button>
                    </li>
                    {onMoveFile && (
                      <li>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            document.activeElement.blur();
                            onMoveFile(file);
                          }}
                          disabled={!file.owner}
                        >
                          <FontAwesomeIcon icon={faFolder} /> 이동
                        </button>
                      </li>
                    )}
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
                        <FontAwesomeIcon icon={faTrash} /> 삭제
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
    </div>
  );
}
