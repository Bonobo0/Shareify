"use client";

import { useState } from "react";
import { deleteFile } from "@/actions/files";
import { deleteDirectoryRecursive } from "@/actions/directories";

export default function BulkActionHandler({
  selectedItems,
  onSelectionChange,
  onRefresh,
  onShowAlert,
  onShowConfirm,
  files = [],
  directories = [],
}) {
  const [selectMode, setSelectMode] = useState(false);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  const toggleSelectMode = () => {
    setSelectMode(!selectMode);
    onSelectionChange(new Set());
  };

  const toggleItemSelection = (type, id) => {
    const itemKey = `${type}-${id}`;
    const newSelected = new Set(selectedItems);

    if (newSelected.has(itemKey)) {
      newSelected.delete(itemKey);
    } else {
      newSelected.add(itemKey);
    }

    onSelectionChange(newSelected);
  };

  const selectAllItems = () => {
    const allItems = new Set();
    directories.forEach((dir) => allItems.add(`directory-${dir.id}`));
    files.forEach((file) => allItems.add(`file-${file.id}`));
    onSelectionChange(allItems);
  };

  const clearSelection = () => {
    onSelectionChange(new Set());
  };

  const handleBulkDelete = async () => {
    console.log("handleBulkDelete 호출됨, selectedItems:", selectedItems);
    if (selectedItems.size === 0) return;

    onShowConfirm(
      `선택된 ${selectedItems.size}개 항목을 삭제하시겠습니까?`,
      async () => {
        console.log("삭제 확인됨, 삭제 시작");
        setBulkActionLoading(true);
        try {
          const deletePromises = [];

          selectedItems.forEach((itemKey) => {
            const [type, id] = itemKey.split("-");
            console.log(`삭제할 항목: ${type} - ${id}`);

            if (type === "file") {
              deletePromises.push(deleteFile({ fileId: id }));
            } else if (type === "directory") {
              deletePromises.push(
                deleteDirectoryRecursive({ directoryId: id })
              );
            }
          });

          console.log("삭제 요청들:", deletePromises.length);
          const results = await Promise.all(deletePromises);
          console.log("삭제 결과:", results);

          // 에러 확인 - success가 false이거나 error가 있는 경우
          const errors = results.filter(
            (result) => !result.success || result.error
          );
          if (errors.length > 0) {
            console.error("삭제 오류:", errors);
            onShowAlert(
              `일부 항목 삭제 실패: ${errors[0].error || "알 수 없는 오류"}`
            );
            onSelectionChange(new Set());
            setSelectMode(false);
            // 목록 새로고침
            await onRefresh();
          } else {
            console.log("삭제 성공, 상태 업데이트");
            onShowAlert(
              `${selectedItems.size}개 항목이 성공적으로 삭제되었습니다.`
            );
            onSelectionChange(new Set());
            setSelectMode(false);
            // 목록 새로고침
            await onRefresh();
          }
        } catch (error) {
          console.error("대량 삭제 오류:", error);
          onShowAlert("대량 삭제 중 오류가 발생했습니다.");
        } finally {
          setBulkActionLoading(false);
        }
      }
    );
  };

  return {
    selectMode,
    bulkActionLoading,
    toggleSelectMode,
    toggleItemSelection,
    selectAllItems,
    clearSelection,
    handleBulkDelete,

    // 렌더링 컴포넌트
    BulkActionControls: () => (
      <div className="flex items-center justify-between bg-base-200 p-4 rounded-lg">
        <div className="flex items-center gap-4">
          <button
            onClick={toggleSelectMode}
            className={`btn btn-sm ${
              selectMode ? "btn-primary" : "btn-outline"
            }`}
          >
            {selectMode ? "선택 모드 종료" : "다중 선택"}
          </button>

          {selectMode && (
            <>
              <button
                onClick={selectAllItems}
                className="btn btn-sm btn-ghost"
                disabled={
                  selectedItems.size === files.length + directories.length
                }
              >
                전체 선택
              </button>

              <button
                onClick={clearSelection}
                className="btn btn-sm btn-ghost"
                disabled={selectedItems.size === 0}
              >
                선택 해제
              </button>

              <span className="text-sm text-gray-600">
                {selectedItems.size}개 항목 선택됨
              </span>
            </>
          )}
        </div>

        {selectMode && selectedItems.size > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleBulkDelete}
              className={`btn btn-sm btn-error ${
                bulkActionLoading ? "loading" : ""
              }`}
              disabled={bulkActionLoading}
            >
              선택한 항목 삭제
            </button>
          </div>
        )}
      </div>
    ),

    // 테이블 헤더용 체크박스
    SelectAllCheckbox: () =>
      selectMode && (
        <th>
          <input
            type="checkbox"
            className="checkbox"
            checked={
              selectedItems.size === files.length + directories.length &&
              files.length + directories.length > 0
            }
            onChange={(e) => {
              if (e.target.checked) {
                selectAllItems();
              } else {
                clearSelection();
              }
            }}
          />
        </th>
      ),

    // 개별 행용 체크박스
    ItemCheckbox: ({ type, id, onClick }) =>
      selectMode && (
        <td onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            className="checkbox"
            checked={selectedItems.has(`${type}-${id}`)}
            onChange={() => toggleItemSelection(type, id)}
            onClick={onClick}
          />
        </td>
      ),
  };
}
