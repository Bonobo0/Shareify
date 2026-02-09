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
    <div className="overflow-x-auto overflow-y-visible -mx-2 sm:mx-0 relative">
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
                    <div className="flex items-center gap-1 mt-1">
                      <div className="badge badge-accent badge-xs sm:badge-sm gap-1 text-xs whitespace-nowrap">
                        <span><FontAwesomeIcon icon={faUser} /></span>
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
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {file.isEncrypted && (
                        <div className="badge badge-primary badge-xs sm:badge-sm whitespace-nowrap">
                          <FontAwesomeIcon icon={faLock} /> 암호화됨
                        </div>
                      )}
                      {file.isWebGLBuild && (
                        <div className="badge badge-secondary badge-xs sm:badge-sm whitespace-nowrap">
                          <FontAwesomeIcon icon={faGamepad} /> WebGL 게임
                        </div>
                      )}
                      {file.isPublic && (
                        <div className="badge badge-success badge-xs sm:badge-sm whitespace-nowrap">
                          공개
                        </div>
                      )}
                      {!file.owner && file.ownerInfo && (
                        <div className="badge badge-accent badge-xs sm:badge-sm gap-1 whitespace-nowrap">
                          <span><FontAwesomeIcon icon={faUser} /></span>
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
                            <span><FontAwesomeIcon icon={faFolder} /></span>
                            <span className="truncate max-w-[100px] sm:max-w-none">
                              {file.parentDirectoryInfo?.owner.name ||
                                file.parentDirectoryInfo?.owner.email}
                              님의 {file.parentDirectoryInfo?.name}에 업로드됨
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
  );
}
