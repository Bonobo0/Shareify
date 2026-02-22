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
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 mb-20">
      <div className="flex items-center gap-2 text-sm">
        <span>페이지당</span>
        <select
          className="select select-bordered select-xs"
          value={itemsPerPage}
          onChange={(e) => onItemsPerPageChange(e.target.value)}
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
