"use client";

import { useEffect } from "react";
import useSearchStore from "@/app/stores/searchStore";
import { aiFileStatus } from "@/app/actions/ai";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faSpinner,
  faCheckCircle,
  faExclamationCircle,
  faRobot,
} from "@fortawesome/free-solid-svg-icons";

const POLL_INTERVAL_MS = 3000;
const TERMINAL_STATUSES = ["completed", "failed", "error"];

export default function FileStatus() {
  const { indexingFiles, updateIndexingFile, removeIndexingFile } =
    useSearchStore();

  const entries = Object.values(indexingFiles);
  const activeFileIds = entries
    .filter((f) => !TERMINAL_STATUSES.includes(f.status))
    .map((f) => f.fileId)
    .sort()
    .join(",");

  useEffect(() => {
    if (!activeFileIds) return;

    const timers = activeFileIds.split(",").map((fileId) => {
      const timer = setInterval(async () => {
        const result = await aiFileStatus(fileId);
        if (result.error) {
          updateIndexingFile(fileId, { status: "error", error: result.error });
          clearInterval(timer);
          return;
        }
        updateIndexingFile(fileId, {
          status: result.status,
          progress: result.progress,
        });
        if (TERMINAL_STATUSES.includes(result.status)) {
          clearInterval(timer);
          // 완료 후 5초 뒤 목록에서 제거
          setTimeout(() => removeIndexingFile(fileId), 5000);
        }
      }, POLL_INTERVAL_MS);
      return timer;
    });

    return () => timers.forEach(clearInterval);
  }, [activeFileIds]); // eslint-disable-line react-hooks/exhaustive-deps

  if (entries.length === 0) return null;

  return (
    <div className="mb-4 flex flex-col gap-2">
      {entries.map((f) => (
        <div
          key={f.fileId}
          className="flex items-center gap-3 p-3 rounded-lg border border-base-300 bg-base-100 text-sm"
        >
          <FontAwesomeIcon icon={faRobot} className="text-primary" />
          <span className="flex-1 truncate">
            <span className="font-medium">{f.filename ?? f.fileId}</span>
            &nbsp;— AI 인덱싱
          </span>
          {f.status === "completed" && (
            <span className="text-success flex items-center gap-1">
              <FontAwesomeIcon icon={faCheckCircle} /> 완료
            </span>
          )}
          {(f.status === "failed" || f.status === "error") && (
            <span className="text-error flex items-center gap-1">
              <FontAwesomeIcon icon={faExclamationCircle} /> 실패
            </span>
          )}
          {!TERMINAL_STATUSES.includes(f.status) && (
            <span className="text-info flex items-center gap-1">
              <FontAwesomeIcon icon={faSpinner} className="animate-spin" />
              {typeof f.progress === "number"
                ? `${f.progress}%`
                : "처리 중..."}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
