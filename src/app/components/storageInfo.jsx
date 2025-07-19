"use client";

export default function StorageInfo({
  usedStorage,
  totalStorage,
  availableStorage,
  percentage
}) {
  const formatBytes = (bytes, decimals = 2) => {
    if (bytes === 0) return "0 Bytes";

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
  };

  // 만약 값이 없으면 기본값 사용
  const used = usedStorage || 0;
  const total = totalStorage || 50 * 1024 * 1024 * 1024; // 50GB
  const available = availableStorage || (total - used);
  const usagePercentage = percentage || ((used / total) * 100);
  
  // 경고 수준에 따라 색상 결정
  const getProgressColor = () => {
    if (usagePercentage > 90) return "progress-error";
    if (usagePercentage > 75) return "progress-warning";
    return "progress-success";
  };

  return (
    <div className="card bg-base-200 p-6 mb-6">
      <h2 className="text-xl font-semibold mb-4">스토리지 정보</h2>

      <div className="mb-2">
        <div className="flex justify-between mb-1">
          <span>
            {formatBytes(used)} / {formatBytes(total)} 사용 중
          </span>
          <span>{usagePercentage.toFixed(1)}%</span>
        </div>
        
        <progress
          className={`progress w-full ${getProgressColor()}`}
          value={usagePercentage}
          max="100"
        ></progress>
      </div>

      <div className="stats stats-vertical lg:stats-horizontal shadow mt-2">
        <div className="stat">
          <div className="stat-title">사용 중</div>
          <div className="stat-value text-primary">{formatBytes(used)}</div>
        </div>

        <div className="stat">
          <div className="stat-title">남은 공간</div>
          <div className="stat-value">{formatBytes(available)}</div>
        </div>

        <div className="stat">
          <div className="stat-title">총 용량</div>
          <div className="stat-value">{formatBytes(total)}</div>
        </div>
      </div>
    </div>
  );
}
