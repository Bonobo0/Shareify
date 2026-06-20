"use client";

import { useMemo } from "react";

export default function StorageInfo({
  usedStorage,
  totalStorage,
  availableStorage,
  percentage,
}) {
  const formatBytes = (bytes, decimals = 2) => {
    if (!bytes) return "0 B";
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
  };

  const used = usedStorage || 0;
  const total = totalStorage || 5 * 1024 * 1024 * 1024;
  const available = availableStorage || total - used;
  const usagePercentage = percentage || (used / total) * 100;

  // Ring chart calculations
  const radius = 54;
  const stroke = 8;
  const normalizedRadius = radius - stroke / 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset =
    circumference - (Math.min(usagePercentage, 100) / 100) * circumference;

  const getColor = () => {
    if (usagePercentage > 90) return { stroke: "#EF4444", text: "text-error" };
    if (usagePercentage > 75)
      return { stroke: "#F59E0B", text: "text-warning" };
    return { stroke: "#3B82F6", text: "text-brand-400" };
  };

  const color = getColor();

  return (
    <div className="card-surface p-6">
      <div className="flex flex-col items-center gap-6 sm:flex-row">
        {/* Ring chart */}
        <div className="relative flex-shrink-0">
          <svg
            height={radius * 2}
            width={radius * 2}
            className="-rotate-90"
          >
            <circle
              stroke="#1E293B"
              fill="transparent"
              strokeWidth={stroke}
              r={normalizedRadius}
              cx={radius}
              cy={radius}
            />
            <circle
              stroke={color.stroke}
              fill="transparent"
              strokeWidth={stroke}
              strokeDasharray={`${circumference} ${circumference}`}
              style={{ strokeDashoffset, transition: "stroke-dashoffset 0.6s ease-out" }}
              strokeLinecap="round"
              r={normalizedRadius}
              cx={radius}
              cy={radius}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-2xl font-bold tabular-nums ${color.text}`}>
              {usagePercentage.toFixed(1)}%
            </span>
            <span className="text-[10px] text-base-content/40">사용 중</span>
          </div>
        </div>

        {/* Stats */}
        <div className="grid flex-1 grid-cols-3 gap-4">
          <div className="text-center sm:text-left">
            <p className="stat-label">사용 중</p>
            <p className="stat-value text-brand-400 text-lg sm:text-2xl">
              {formatBytes(used)}
            </p>
          </div>
          <div className="text-center sm:text-left">
            <p className="stat-label">남은 공간</p>
            <p className="stat-value text-lg sm:text-2xl">
              {formatBytes(available)}
            </p>
          </div>
          <div className="text-center sm:text-left">
            <p className="stat-label">총 용량</p>
            <p className="stat-value text-lg sm:text-2xl">
              {formatBytes(total)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
