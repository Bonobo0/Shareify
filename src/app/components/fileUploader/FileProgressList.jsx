"use client";

import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faMagnifyingGlass,
  faLock,
  faUpload,
  faCircleCheck,
  faCircleXmark,
} from "@fortawesome/free-solid-svg-icons";

export default function FileProgressList({ files, progress }) {
  if (files.length === 0) return null;

  return (
    <div className="space-y-3">
      {files.map((file, index) => (
        <div
          key={index}
          className="rounded-lg border border-surface-300/40 bg-surface-50/50 p-3"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-sm font-medium">
              {file.name}
            </span>
            <span className="shrink-0 text-xs tabular-nums text-base-content/50">
              {(file.size / 1024).toFixed(1)} KB
            </span>
          </div>

          {progress[file.name] && (
            <div className="mt-2">
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5">
                  {progress[file.name].status === "validating" && (
                    <>
                      <FontAwesomeIcon
                        icon={faMagnifyingGlass}
                        className="text-info"
                      />
                      <span className="text-info">WebGL 검증 중...</span>
                    </>
                  )}
                  {progress[file.name].status === "encrypting" && (
                    <>
                      <FontAwesomeIcon
                        icon={faLock}
                        className="text-warning"
                      />
                      <span className="text-warning">암호화 중...</span>
                    </>
                  )}
                  {progress[file.name].status === "uploading" && (
                    <>
                      <FontAwesomeIcon
                        icon={faUpload}
                        className="text-brand-400"
                      />
                      <span className="text-brand-400">업로드 중...</span>
                    </>
                  )}
                  {progress[file.name].status === "success" && (
                    <>
                      <FontAwesomeIcon
                        icon={faCircleCheck}
                        className="text-success"
                      />
                      <span className="text-success">완료</span>
                    </>
                  )}
                  {progress[file.name].status === "error" && (
                    <>
                      <FontAwesomeIcon
                        icon={faCircleXmark}
                        className="text-error"
                      />
                      <span className="text-error">
                        {progress[file.name].error || "오류"}
                      </span>
                    </>
                  )}
                </span>
                <span className="tabular-nums text-base-content/40">
                  {progress[file.name].percent}%
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-surface-300">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    progress[file.name].status === "success"
                      ? "bg-success"
                      : progress[file.name].status === "error"
                        ? "bg-error"
                        : progress[file.name].status === "encrypting"
                          ? "bg-warning"
                          : "bg-brand-500"
                  }`}
                  style={{ width: `${progress[file.name].percent}%` }}
                />
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
