"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { getAllDirectoriesFlat } from "@/actions/directories";
import { createDirectory } from "@/actions/directories";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFolder, faFolderOpen } from "@fortawesome/free-solid-svg-icons";

/**
 * 디렉토리를 트리 구조로 빌드
 */
function buildTree(flatDirs) {
  const map = new Map();
  const roots = [];

  flatDirs.forEach((d) => {
    map.set(d.id, { ...d, children: [] });
  });

  flatDirs.forEach((d) => {
    const node = map.get(d.id);
    if (d.parentId && map.has(d.parentId)) {
      map.get(d.parentId).children.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
}

/**
 * 트리 노드 재귀 렌더링
 */
function TreeNode({
  node,
  depth,
  selectedId,
  onSelect,
  expandedIds,
  onToggle,
}) {
  const isExpanded = expandedIds.has(node.id);
  const isSelected = selectedId === node.id;
  const hasChildren = node.children.length > 0;

  return (
    <>
      <li>
        <button
          className={`flex items-center gap-1 w-full text-left py-1.5 px-2 rounded-md text-sm transition-colors
            ${isSelected ? "bg-primary text-primary-content" : "hover:bg-base-300"}
          `}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={() => onSelect(node.id)}
        >
          {/* 토글 화살표 */}
          <span
            className={`inline-flex items-center justify-center w-4 h-4 text-xs flex-shrink-0 cursor-pointer ${
              hasChildren ? "opacity-100" : "opacity-0"
            }`}
            onClick={(e) => {
              e.stopPropagation();
              if (hasChildren) onToggle(node.id);
            }}
          >
            {hasChildren ? (isExpanded ? "▾" : "▸") : ""}
          </span>
          <span className="flex-shrink-0">{hasChildren ? <FontAwesomeIcon icon={faFolderOpen} /> : <FontAwesomeIcon icon={faFolder} />}</span>
          <span className="truncate">{node.name}</span>
        </button>
      </li>
      {isExpanded &&
        hasChildren &&
        node.children.map((child) => (
          <TreeNode
            key={child.id}
            node={child}
            depth={depth + 1}
            selectedId={selectedId}
            onSelect={onSelect}
            expandedIds={expandedIds}
            onToggle={onToggle}
          />
        ))}
    </>
  );
}

/**
 * DirectoryTreePicker - 계층 구조 디렉토리 선택기 + 생성 기능
 *
 * Props:
 * - value: 선택된 디렉토리 ID (null = 루트)
 * - onChange: (dirId) => void
 * - disabled: boolean
 * - onDirectoriesLoaded: (dirs) => void (optional)
 */
export default function DirectoryTreePicker({
  value,
  onChange,
  disabled = false,
  onDirectoriesLoaded,
}) {
  const [flatDirs, setFlatDirs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState(new Set());
  const [search, setSearch] = useState("");

  // 새 디렉토리 생성
  const [showCreateInput, setShowCreateInput] = useState(false);
  const [newDirName, setNewDirName] = useState("");
  const [creatingDir, setCreatingDir] = useState(false);
  const [createError, setCreateError] = useState("");

  const fetchDirs = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getAllDirectoriesFlat();
      if (!result.error) {
        setFlatDirs(result.directories || []);
        if (onDirectoriesLoaded) onDirectoriesLoaded(result.directories || []);
      }
    } catch {}
    setLoading(false);
  }, [onDirectoriesLoaded]);

  useEffect(() => {
    fetchDirs();
  }, [fetchDirs]);

  const tree = useMemo(() => buildTree(flatDirs), [flatDirs]);

  // 검색 필터링된 디렉토리 (검색 시 flat 모드)
  const filteredFlat = useMemo(() => {
    if (!search) return null;
    return flatDirs.filter(
      (d) =>
        d.name.toLowerCase().includes(search.toLowerCase()) ||
        d.fullPath.toLowerCase().includes(search.toLowerCase()),
    );
  }, [search, flatDirs]);

  const handleToggle = useCallback((id) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleCreateDir = async () => {
    if (!newDirName.trim()) return;
    setCreatingDir(true);
    setCreateError("");

    try {
      const result = await createDirectory({
        name: newDirName.trim(),
        parentId: value || null, // 현재 선택된 디렉토리 아래에 생성
      });

      if (result.error) {
        setCreateError(result.error);
        return;
      }

      setNewDirName("");
      setShowCreateInput(false);

      // 디렉토리 목록 새로고침
      await fetchDirs();

      // 새로 생성된 디렉토리 선택
      if (result.directory?.id) {
        onChange(result.directory.id);
        // 부모 디렉토리 펼치기
        if (value) {
          setExpandedIds((prev) => new Set([...prev, value]));
        }
      }
    } catch {
      setCreateError("디렉토리 생성에 실패했습니다.");
    } finally {
      setCreatingDir(false);
    }
  };

  // 현재 선택된 디렉토리 경로
  const selectedDirName = useMemo(() => {
    if (!value) return <><FontAwesomeIcon icon={faFolder} /> 최상위 (루트)</>;
    const dir = flatDirs.find((d) => d.id === value);
    return dir ? <><FontAwesomeIcon icon={faFolderOpen} /> {dir.fullPath}</> : <><FontAwesomeIcon icon={faFolder} /> 최상위 (루트)</>;
  }, [value, flatDirs]);

  if (disabled || loading) {
    return (
      <div className="border border-base-300 rounded-lg p-3">
        <div className="flex items-center gap-2 text-sm opacity-60">
          {loading ? (
            <>
              <span className="loading loading-spinner loading-xs"></span>
              디렉토리 불러오는 중...
            </>
          ) : (
            <span>{selectedDirName}</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="border border-base-300 rounded-lg">
      {/* 검색 + 생성 버튼 */}
      <div className="flex items-center gap-1 p-2 border-b border-base-300">
        <input
          type="text"
          className="input input-bordered input-xs flex-1"
          placeholder="디렉토리 검색..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button
          className="btn btn-ghost btn-xs"
          onClick={() => {
            setShowCreateInput(!showCreateInput);
            setCreateError("");
          }}
          title="새 디렉토리 만들기"
        >
          ➕
        </button>
      </div>

      {/* 새 디렉토리 생성 입력 */}
      {showCreateInput && (
        <div className="px-2 py-2 border-b border-base-300 bg-base-200/50">
          <p className="text-xs opacity-60 mb-1.5">
            {value
              ? `"${flatDirs.find((d) => d.id === value)?.name || ""}" 안에 생성`
              : "루트에 생성"}
          </p>
          <div className="flex items-center gap-1">
            <input
              type="text"
              className="input input-bordered input-xs flex-1"
              placeholder="새 디렉토리 이름"
              value={newDirName}
              onChange={(e) => setNewDirName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateDir();
                if (e.key === "Escape") {
                  setShowCreateInput(false);
                  setNewDirName("");
                }
              }}
              autoFocus
              disabled={creatingDir}
            />
            <button
              className={`btn btn-primary btn-xs ${creatingDir ? "loading" : ""}`}
              onClick={handleCreateDir}
              disabled={creatingDir || !newDirName.trim()}
            >
              생성
            </button>
          </div>
          {createError && (
            <p className="text-xs text-error mt-1">{createError}</p>
          )}
        </div>
      )}

      {/* 디렉토리 트리 */}
      <div className="max-h-48 overflow-y-auto p-1">
        <ul className="space-y-0.5">
          {/* 루트 옵션 */}
          <li>
            <button
              className={`flex items-center gap-1 w-full text-left py-1.5 px-2 rounded-md text-sm transition-colors
                ${value === null ? "bg-primary text-primary-content" : "hover:bg-base-300"}
              `}
              onClick={() => onChange(null)}
            >
              <span className="inline-flex items-center justify-center w-4 h-4 text-xs flex-shrink-0 opacity-0">
                ▸
              </span>
              <span className="flex-shrink-0"><FontAwesomeIcon icon={faFolder} /></span>
              <span>최상위 (루트)</span>
            </button>
          </li>

          {/* 검색 모드: flat 목록 */}
          {filteredFlat
            ? filteredFlat.map((dir) => (
                <li key={dir.id}>
                  <button
                    className={`flex items-center gap-1 w-full text-left py-1.5 px-2 rounded-md text-sm transition-colors
                      ${value === dir.id ? "bg-primary text-primary-content" : "hover:bg-base-300"}
                    `}
                    onClick={() => onChange(dir.id)}
                  >
                    <span className="inline-flex items-center justify-center w-4 h-4 text-xs flex-shrink-0 opacity-0">
                      ▸
                    </span>
                    <span className="flex-shrink-0"><FontAwesomeIcon icon={faFolderOpen} /></span>
                    <span className="truncate">{dir.fullPath}</span>
                  </button>
                </li>
              ))
            : // 트리 모드
              tree.map((node) => (
                <TreeNode
                  key={node.id}
                  node={node}
                  depth={1}
                  selectedId={value}
                  onSelect={onChange}
                  expandedIds={expandedIds}
                  onToggle={handleToggle}
                />
              ))}

          {flatDirs.length === 0 && !loading && (
            <li className="py-3 text-center text-xs opacity-50">
              디렉토리가 없습니다
            </li>
          )}
          {filteredFlat && filteredFlat.length === 0 && (
            <li className="py-3 text-center text-xs opacity-50">
              검색 결과가 없습니다
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
