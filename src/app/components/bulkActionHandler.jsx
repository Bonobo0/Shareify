"use client";

import { useState, useMemo } from "react";
import { deleteFile } from "@/actions/files";
import { deleteDirectoryRecursive } from "@/actions/directories";
import SelectedDownloadModal from "./selectedDownloadModal";

export default function BulkActionHandler({
  selectedItems,
  onSelectionChange,
  onRefresh,
  onShowAlert,
  onShowConfirm,
  files = [],
  directories = [],
  onBulkMove,
}) {
  const [selectMode, setSelectMode] = useState(false);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [deleteProgress, setDeleteProgress] = useState({
    show: false,
    current: 0,
    total: 0,
    currentItem: "",
  });

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

  // selectedFiles를 메모이제이션하여 불필요한 리렌더링 방지
  const selectedFiles = useMemo(() => {
    return Array.from(selectedItems)
      .filter((item) => item.startsWith("file-"))
      .map((item) => item.replace("file-", ""));
  }, [selectedItems]);

  const handleBulkDelete = async () => {
    if (selectedItems.size === 0) return;

    onShowConfirm(
      `선택된 ${selectedItems.size}개 항목을 삭제하시겠습니까?`,
      async () => {
        setBulkActionLoading(true);
        setDeleteProgress({
          show: true,
          current: 0,
          total: selectedItems.size,
          currentItem: "",
        });

        try {
          const itemsArray = Array.from(selectedItems);
          const results = [];

          // 순차적으로 삭제하여 진행 상황 표시
          for (let i = 0; i < itemsArray.length; i++) {
            const itemKey = itemsArray[i];
            const [type, id] = itemKey.split("-");

            // 현재 삭제 중인 항목 정보 찾기
            let itemName = "";
            if (type === "file") {
              const file = files.find((f) => f.id === id);
              itemName = file ? file.originalName : `파일 ${id}`;
            } else if (type === "directory") {
              const directory = directories.find((d) => d.id === id);
              itemName = directory ? directory.name : `디렉토리 ${id}`;
            }

            setDeleteProgress((prev) => ({
              ...prev,
              current: i + 1,
              currentItem: itemName,
            }));

            try {
              let result;
              if (type === "file") {
                result = await deleteFile({ fileId: id });
              } else if (type === "directory") {
                result = await deleteDirectoryRecursive({ directoryId: id });
              }
              results.push(result);
            } catch (error) {
              results.push({ success: false, error: error.message });
            }
          }

          // 에러 확인
          const errors = results.filter(
            (result) => !result.success || result.error,
          );

          setDeleteProgress({
            show: false,
            current: 0,
            total: 0,
            currentItem: "",
          });

          if (errors.length > 0) {
            onShowAlert(
              `일부 항목 삭제 실패: ${errors[0].error || "알 수 없는 오류"}`,
            );
          } else {
            onShowAlert(
              `${selectedItems.size}개 항목이 성공적으로 삭제되었습니다.`,
            );
          }

          onSelectionChange(new Set());
          setSelectMode(false);
          await onRefresh();
        } catch (error) {
          setDeleteProgress({
            show: false,
            current: 0,
            total: 0,
            currentItem: "",
          });
          onShowAlert("대량 삭제 중 오류가 발생했습니다.");
        } finally {
          setBulkActionLoading(false);
        }
      },
    );
  };

  const handleBulkDownload = () => {
    console.log("handleBulkDownload 호출됨");
    console.log("selectedItems:", selectedItems);
    console.log("selectedItems.size:", selectedItems.size);

    if (selectedItems.size === 0) {
      console.log("선택된 아이템이 없음");
      return;
    }

    console.log("선택된 아이템들:", Array.from(selectedItems));
    console.log("필터링된 파일 IDs:", selectedFiles);

    if (selectedFiles.length === 0) {
      console.log("다운로드할 파일이 없음");
      onShowAlert(
        "다운로드할 파일을 선택해주세요. (디렉토리는 지원되지 않습니다)",
      );
      return;
    }

    console.log("선택 다운로드 모달 열기");
    setShowDownloadModal(true);
  };

  return {
    selectMode,
    bulkActionLoading,
    deleteProgress,
    showDownloadModal,
    toggleSelectMode,
    toggleItemSelection,
    selectAllItems,
    clearSelection,
    handleBulkDelete,
    handleBulkDownload,
    setShowDownloadModal,
    setSelectMode, // selectMode setter 추가

    // 렌더링 컴포넌트
    BulkActionControls: () => (
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-base-200 p-4 sm:p-4 rounded-lg gap-2 sm:gap-0">
        <div className="flex flex-wrap items-center gap-2 sm:gap-4">
          <button
            onClick={toggleSelectMode}
            className={`btn btn-xs sm:btn-sm ${
              selectMode ? "btn-primary" : "btn-outline"
            }`}
          >
            {selectMode ? "선택 모드 종료" : "다중 선택"}
          </button>

          {selectMode && (
            <>
              <button
                onClick={selectAllItems}
                className="btn btn-xs sm:btn-sm btn-ghost"
                disabled={
                  selectedItems.size === files.length + directories.length
                }
              >
                전체 선택
              </button>

              <button
                onClick={clearSelection}
                className="btn btn-xs sm:btn-sm btn-ghost"
                disabled={selectedItems.size === 0}
              >
                선택 해제
              </button>

              <span className="text-xs sm:text-sm text-gray-600 whitespace-nowrap">
                {selectedItems.size}개 선택됨
              </span>
            </>
          )}
        </div>

        {selectMode && selectedItems.size > 0 && (
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => {
                if (selectedFiles.length > 0) {
                  handleBulkDownload();
                } else {
                  onShowAlert("다운로드할 파일을 선택해주세요.");
                }
              }}
              className="btn btn-xs sm:btn-sm btn-info flex-1 sm:flex-none"
              disabled={bulkActionLoading}
            >
              📥 다운로드
            </button>

            {onBulkMove && (
              <button
                onClick={() => onBulkMove(selectedItems)}
                className="btn btn-xs sm:btn-sm btn-accent flex-1 sm:flex-none"
                disabled={bulkActionLoading}
              >
                📁 이동
              </button>
            )}

            <button
              onClick={handleBulkDelete}
              className={`btn btn-xs sm:btn-sm btn-error flex-1 sm:flex-none ${
                bulkActionLoading ? "loading" : ""
              }`}
              disabled={bulkActionLoading}
            >
              🗑️ 삭제
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

    // 삭제 진행 상황 모달
    DeleteProgressModal: () =>
      deleteProgress.show && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg mb-4">항목 삭제 중...</h3>

            <div className="space-y-4">
              {/* 진행률 바 */}
              <div className="w-full">
                <div className="flex justify-between text-sm mb-2">
                  <span>진행률</span>
                  <span>
                    {deleteProgress.current} / {deleteProgress.total}
                  </span>
                </div>
                <progress
                  className="progress progress-primary w-full"
                  value={deleteProgress.current}
                  max={deleteProgress.total}
                ></progress>
                <div className="text-center text-sm mt-1 text-gray-600">
                  {Math.round(
                    (deleteProgress.current / deleteProgress.total) * 100,
                  )}
                  %
                </div>
              </div>

              {/* 현재 처리 중인 항목 */}
              <div className="text-center">
                <div className="text-sm text-gray-600 mb-2">현재 삭제 중:</div>
                <div className="font-medium text-primary">
                  {deleteProgress.currentItem}
                </div>
              </div>

              {/* 로딩 스피너 */}
              <div className="flex justify-center">
                <div className="loading loading-spinner loading-md"></div>
              </div>

              {/* 주의사항 */}
              <div className="alert alert-warning">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="stroke-current shrink-0 h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.728-.833-2.498 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                  />
                </svg>
                <span className="text-sm">
                  작업을 취소하지 마세요. 데이터 손실이 발생할 수 있습니다.
                </span>
              </div>
            </div>
          </div>
        </div>
      ),

    // 선택 다운로드 모달
    SelectedDownloadModal: () => {
      return (
        <SelectedDownloadModal
          key={showDownloadModal ? "open" : "closed"} // 모달 상태에 따라 key 변경으로 재마운트 방지
          isOpen={showDownloadModal}
          onClose={() => setShowDownloadModal(false)}
          selectedFiles={selectedFiles}
          onClearSelection={() => {
            clearSelection();
            setSelectMode(false);
          }}
        />
      );
    },
  };
}
