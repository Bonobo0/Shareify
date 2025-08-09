"use client";

import React from "react";

export default function Paginator({
  currentPage = 1,
  totalPages = 1,
  onPageChange,
  totalItems = 0,
  itemsPerPage = 20,
  className = "",
}) {
  // 페이지 번호 배열 생성 (현재 페이지 주변으로 제한)
  const getPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;
    const halfVisible = Math.floor(maxVisiblePages / 2);

    let startPage = Math.max(1, currentPage - halfVisible);
    let endPage = Math.min(totalPages, currentPage + halfVisible);

    // 시작 또는 끝에서 부족한 페이지를 반대편으로 보정
    if (endPage - startPage + 1 < maxVisiblePages) {
      if (startPage === 1) {
        endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
      } else if (endPage === totalPages) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
      }
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }

    return pages;
  };

  const pageNumbers = getPageNumbers();

  return (
    <div className={`flex flex-col gap-4 ${className}`}>
      {/* 페이지네이션 버튼 */}
      <div className="flex justify-center">
        <div className="join">
          {/* 처음 페이지 버튼 */}
          <button
            className={`join-item btn ${
              currentPage === 1 ? "btn-disabled" : ""
            }`}
            onClick={() => onPageChange(1)}
            disabled={currentPage === 1}
            title="첫 페이지"
          >
            ««
          </button>

          {/* 이전 페이지 버튼 */}
          <button
            className={`join-item btn ${
              currentPage === 1 ? "btn-disabled" : ""
            }`}
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            title="이전 페이지"
          >
            «
          </button>

          {/* 시작 생략 표시 */}
          {pageNumbers[0] > 1 && (
            <>
              <button className="join-item btn" onClick={() => onPageChange(1)}>
                1
              </button>
              {pageNumbers[0] > 2 && (
                <span className="join-item btn btn-disabled">...</span>
              )}
            </>
          )}

          {/* 페이지 번호 버튼들 */}
          {pageNumbers.map((pageNum) => (
            <button
              key={pageNum}
              className={`join-item btn ${
                pageNum === currentPage ? "btn-active" : ""
              }`}
              onClick={() => onPageChange(pageNum)}
            >
              {pageNum}
            </button>
          ))}

          {/* 끝 생략 표시 */}
          {pageNumbers[pageNumbers.length - 1] < totalPages && (
            <>
              {pageNumbers[pageNumbers.length - 1] < totalPages - 1 && (
                <span className="join-item btn btn-disabled">...</span>
              )}
              <button
                className="join-item btn"
                onClick={() => onPageChange(totalPages)}
              >
                {totalPages}
              </button>
            </>
          )}

          {/* 다음 페이지 버튼 */}
          <button
            className={`join-item btn ${
              currentPage === totalPages ? "btn-disabled" : ""
            }`}
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            title="다음 페이지"
          >
            »
          </button>

          {/* 마지막 페이지 버튼 */}
          <button
            className={`join-item btn ${
              currentPage === totalPages ? "btn-disabled" : ""
            }`}
            onClick={() => onPageChange(totalPages)}
            disabled={currentPage === totalPages}
            title="마지막 페이지"
          >
            »»
          </button>
        </div>
      </div>

      {/* 페이지 직접 이동 */}
      <div className="flex justify-center items-center gap-2 text-sm">
        <span>페이지 이동:</span>
        <input
          type="number"
          min="1"
          max={totalPages}
          defaultValue={currentPage}
          className="input input-bordered input-xs w-16 text-center"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              const page = parseInt(e.target.value);
              if (page >= 1 && page <= totalPages && page !== currentPage) {
                onPageChange(page);
              }
              e.target.value = currentPage; // 현재 페이지로 리셋
            }
          }}
          onBlur={(e) => {
            e.target.value = currentPage; // 포커스 잃으면 현재 페이지로 리셋
          }}
        />
        <span>/ {totalPages}</span>
      </div>
    </div>
  );
}
