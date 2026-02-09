"use client";

import { useState, useEffect, useCallback } from "react";
import { getAllDirectoriesFlat } from "@/actions/directories";
import { moveFile, bulkMoveFiles } from "@/actions/files";
import { moveDirectory, bulkMoveDirectories } from "@/actions/directories";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFolder, faFolderOpen } from "@fortawesome/free-solid-svg-icons";

/**
 * MoveModal - 단일 이동 및 벌크 이동 모두 지원
 *
 * 단일 모드: item + itemType 전달
 * 벌크 모드: bulkItems (Set: "file-id", "directory-id") + files/directories 전달
 */
export default function MoveModal({
  isOpen,
  onClose,
  item,
  itemType,
  onMoved,
  // 벌크 모드 props
  bulkItems,
  files: allFiles = [],
  directories: allDirItems = [],
}) {
  const [directories, setDirectories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [moving, setMoving] = useState(false);
  const [selectedDirId, setSelectedDirId] = useState(null); // null = 루트
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const isBulk = bulkItems && bulkItems.size > 0;

  const fetchDirectories = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getAllDirectoriesFlat();
      if (result.error) {
        setError(result.error);
        return;
      }
      setDirectories(result.directories || []);
    } catch {
      setError("디렉토리 목록을 불러올 수 없습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchDirectories();
      setSelectedDirId(null);
      setError("");
      setSearch("");
    }
  }, [isOpen, fetchDirectories]);

  // 벌크 모드에서 선택된 아이템 파싱
  const parsedBulkItems = isBulk
    ? (() => {
        const fileIds = [];
        const dirIds = [];
        for (const key of bulkItems) {
          const [type, id] = key.split("-");
          if (type === "file") fileIds.push(id);
          else if (type === "directory") dirIds.push(id);
        }
        return { fileIds, dirIds };
      })()
    : { fileIds: [], dirIds: [] };

  const handleMove = async () => {
    setMoving(true);
    setError("");
    try {
      if (isBulk) {
        // 벌크 이동
        const errors = [];
        if (parsedBulkItems.fileIds.length > 0) {
          const result = await bulkMoveFiles({
            fileIds: parsedBulkItems.fileIds,
            targetDirectoryId: selectedDirId,
          });
          if (result.error) errors.push(result.error);
        }
        if (parsedBulkItems.dirIds.length > 0) {
          const result = await bulkMoveDirectories({
            directoryIds: parsedBulkItems.dirIds,
            targetParentId: selectedDirId,
          });
          if (result.error) errors.push(result.error);
        }
        if (errors.length > 0) {
          setError(errors.join(", "));
          return;
        }
      } else {
        // 단일 이동
        let result;
        if (itemType === "file") {
          result = await moveFile({
            fileId: item.id,
            targetDirectoryId: selectedDirId,
          });
        } else {
          result = await moveDirectory({
            directoryId: item.id,
            targetParentId: selectedDirId,
          });
        }
        if (result.error) {
          setError(result.error);
          return;
        }
      }

      if (onMoved) onMoved();
      onClose();
    } catch {
      setError("이동 중 오류가 발생했습니다.");
    } finally {
      setMoving(false);
    }
  };

  if (!isOpen) return null;

  // 디렉토리 자신 및 하위 디렉토리 필터링
  const excludeIds = new Set();
  if (isBulk) {
    // 벌크 모드: 선택된 디렉토리들과 그 하위 디렉토리 제외
    parsedBulkItems.dirIds.forEach((id) => excludeIds.add(id));
    const addChildren = (parentId) => {
      directories.forEach((d) => {
        if (d.parentId === parentId && !excludeIds.has(d.id)) {
          excludeIds.add(d.id);
          addChildren(d.id);
        }
      });
    };
    parsedBulkItems.dirIds.forEach((id) => addChildren(id));
  } else if (itemType === "directory") {
    excludeIds.add(item.id);
    const addChildren = (parentId) => {
      directories.forEach((d) => {
        if (d.parentId === parentId && !excludeIds.has(d.id)) {
          excludeIds.add(d.id);
          addChildren(d.id);
        }
      });
    };
    addChildren(item.id);
  }

  const filteredDirs = directories.filter((d) => {
    if (excludeIds.has(d.id)) return false;
    if (search) {
      return d.fullPath.toLowerCase().includes(search.toLowerCase());
    }
    return true;
  });

  // 제목 및 설명 텍스트
  const title = isBulk
    ? `${bulkItems.size}개 항목 이동`
    : `${itemType === "file" ? "파일" : "디렉토리"} 이동`;
  const subtitle = isBulk
    ? `파일 ${parsedBulkItems.fileIds.length}개, 디렉토리 ${parsedBulkItems.dirIds.length}개`
    : item?.originalName || item?.name;

  return (
    <div className="modal modal-open">
      <div className="modal-box">
        <h3 className="font-bold text-lg">{title}</h3>
        <p className="text-sm opacity-60 mt-1 truncate">{subtitle}</p>

        {error && (
          <div className="alert alert-error mt-3 text-sm py-2">
            <span>{error}</span>
          </div>
        )}

        <div className="form-control mt-4">
          <input
            type="text"
            className="input input-bordered input-sm"
            placeholder="디렉토리 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="mt-3 max-h-60 overflow-y-auto border border-base-300 rounded-lg">
          {loading ? (
            <div className="flex justify-center py-6">
              <span className="loading loading-spinner loading-md"></span>
            </div>
          ) : (
            <ul className="menu menu-sm p-1">
              {/* 루트(최상위) 옵션 */}
              <li>
                <button
                  className={`${selectedDirId === null ? "active" : ""}`}
                  onClick={() => setSelectedDirId(null)}
                >
                  <FontAwesomeIcon icon={faFolder} /> 최상위 (루트)
                </button>
              </li>
              {filteredDirs.map((dir) => (
                <li key={dir.id}>
                  <button
                    className={`${selectedDirId === dir.id ? "active" : ""}`}
                    onClick={() => setSelectedDirId(dir.id)}
                  >
                    <FontAwesomeIcon icon={faFolderOpen} /> {dir.fullPath}
                  </button>
                </li>
              ))}
              {filteredDirs.length === 0 && !loading && (
                <li className="p-3 text-center text-sm opacity-50">
                  {search ? "검색 결과가 없습니다" : "디렉토리가 없습니다"}
                </li>
              )}
            </ul>
          )}
        </div>

        <div className="modal-action">
          <button className="btn btn-sm" onClick={onClose} disabled={moving}>
            취소
          </button>
          <button
            className={`btn btn-primary btn-sm ${moving ? "loading" : ""}`}
            onClick={handleMove}
            disabled={moving}
          >
            이동
          </button>
        </div>
      </div>
    </div>
  );
}
