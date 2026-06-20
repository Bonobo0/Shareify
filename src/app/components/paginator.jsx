"use client";

import React, { useState, useEffect } from "react";

export default function Paginator({
  currentPage = 1,
  totalPages = 1,
  onPageChange,
  totalItems = 0,
  itemsPerPage = 20,
  className = "",
}) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const maxVisiblePages = isMobile ? 3 : 7;
  const halfVisible = Math.floor(maxVisiblePages / 2);

  const getPageNumbers = () => {
    const pages = [];
    let startPage = Math.max(1, currentPage - halfVisible);
    let endPage = Math.min(totalPages, currentPage + halfVisible);

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

  const btnClass = isMobile
    ? "join-item btn btn-sm min-w-[2rem] px-1"
    : "join-item btn";

  const activeClass = isMobile
    ? "join-item btn btn-sm min-w-[2rem] px-1 btn-active"
    : "join-item btn btn-active";

  const disabledClass = isMobile
    ? "join-item btn btn-sm min-w-[2rem] px-1 btn-disabled"
    : "join-item btn btn-disabled";

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      {/* Pagination buttons */}
      <div className="flex justify-center overflow-x-auto">
        <div className="join flex-shrink-0">
          {/* First page */}
          <button
            className={currentPage === 1 ? disabledClass : btnClass}
            onClick={() => onPageChange(1)}
            disabled={currentPage === 1}
            title="첫 페이지"
          >
            {isMobile ? "«" : "««"}
          </button>

          {/* Previous page */}
          <button
            className={currentPage === 1 ? disabledClass : btnClass}
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            title="이전 페이지"
          >
            «
          </button>

          {/* Start ellipsis */}
          {pageNumbers[0] > 1 && (
            <>
              <button className={btnClass} onClick={() => onPageChange(1)}>
                1
              </button>
              {pageNumbers[0] > 2 && (
                <span className={disabledClass}>…</span>
              )}
            </>
          )}

          {/* Page numbers */}
          {pageNumbers.map((pageNum) => (
            <button
              key={pageNum}
              className={
                pageNum === currentPage ? activeClass : btnClass
              }
              onClick={() => onPageChange(pageNum)}
            >
              {pageNum}
            </button>
          ))}

          {/* End ellipsis */}
          {pageNumbers[pageNumbers.length - 1] < totalPages && (
            <>
              {pageNumbers[pageNumbers.length - 1] < totalPages - 1 && (
                <span className={disabledClass}>…</span>
              )}
              <button
                className={btnClass}
                onClick={() => onPageChange(totalPages)}
              >
                {totalPages}
              </button>
            </>
          )}

          {/* Next page */}
          <button
            className={
              currentPage === totalPages ? disabledClass : btnClass
            }
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            title="다음 페이지"
          >
            »
          </button>

          {/* Last page */}
          <button
            className={
              currentPage === totalPages ? disabledClass : btnClass
            }
            onClick={() => onPageChange(totalPages)}
            disabled={currentPage === totalPages}
            title="마지막 페이지"
          >
            {isMobile ? "»" : "»»"}
          </button>
        </div>
      </div>

      {/* Page info + direct navigation */}
      <div className="flex flex-wrap justify-center items-center gap-2 text-xs sm:text-sm text-base-content/60">
        <span>
          {totalItems > 0
            ? `${(currentPage - 1) * itemsPerPage + 1}–${Math.min(currentPage * itemsPerPage, totalItems)} / ${totalItems}`
            : `페이지 ${currentPage}`}
        </span>
        {!isMobile && (
          <>
            <span className="text-base-content/30">|</span>
            <span>이동:</span>
            <input
              type="number"
              min="1"
              max={totalPages}
              defaultValue={currentPage}
              className="input input-bordered input-xs w-14 text-center"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const page = parseInt(e.target.value);
                  if (page >= 1 && page <= totalPages && page !== currentPage) {
                    onPageChange(page);
                  }
                  e.target.value = currentPage;
                }
              }}
              onBlur={(e) => {
                e.target.value = currentPage;
              }}
            />
            <span>/ {totalPages}</span>
          </>
        )}
      </div>
    </div>
  );
}
