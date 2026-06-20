"use client";

import React from "react";
import Paginator from "../paginator";

export default function PaginationToolbar({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPageChange,
  onItemsPerPageChange,
}) {
  return (
    <div className="mt-6 mb-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
      {/* Items per page selector */}
      <div className="flex items-center gap-2 text-xs sm:text-sm text-base-content/60">
        <span>페이지당</span>
        <select
          className="select select-bordered select-xs"
          value={itemsPerPage}
          onChange={(e) => onItemsPerPageChange(parseInt(e.target.value, 10))}
        >
          {[5, 10, 20, 30, 50, 100].map((n) => (
            <option key={n} value={n}>
              {n}개
            </option>
          ))}
        </select>
      </div>

      <Paginator
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={totalItems}
        itemsPerPage={itemsPerPage}
        onPageChange={onPageChange}
      />
    </div>
  );
}
