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
    <div>
      <h3 className="font-semibold mb-2">선택된 파일:</h3>
      <ul className="list-disc pl-5">
        {files.map((file, index) => (
          <li key={index} className="mb-2">
            <div className="flex justify-between items-center">
              <span>
                {file.name} ({(file.size / 1024).toFixed(2)} KB)
              </span>
              {progress[file.name] && (
                <span className="text-sm">
                  {progress[file.name].percent}%
                </span>
              )}
            </div>

            {progress[file.name] && (
              <div className="mt-1">
                <div className="flex justify-between text-xs text-gray-600 mb-1">
                  <span>
                    {progress[file.name].status === "validating" &&
                      <><FontAwesomeIcon icon={faMagnifyingGlass} /> WebGL 빌드 검증 중...</>}
                    {progress[file.name].status === "encrypting" &&
                      <><FontAwesomeIcon icon={faLock} /> 암호화 중...</>}
                    {progress[file.name].status === "uploading" &&
                      <><FontAwesomeIcon icon={faUpload} /> 업로드 중...</>}
                    {progress[file.name].status === "success" &&
                      <><FontAwesomeIcon icon={faCircleCheck} /> 완료</>}
                    {progress[file.name].status === "error" &&
                      <><FontAwesomeIcon icon={faCircleXmark} /> 실패: {progress[file.name].error || "알 수 없는 오류"}</>}
                  </span>
                  <span>{progress[file.name].percent}%</span>
                </div>
                <progress
                  className={`progress w-full ${
                    progress[file.name].status === "success"
                      ? "progress-success"
                      : progress[file.name].status === "error"
                      ? "progress-error"
                      : progress[file.name].status === "encrypting"
                      ? "progress-warning"
                      : progress[file.name].status === "validating"
                      ? "progress-info"
                      : "progress-primary"
                  }`}
                  value={progress[file.name].percent}
                  max="100"
                ></progress>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
