"use client";

import { useState, useEffect } from "react";
import { getRateLimitStats, resetRateLimit } from "@/actions/rateLimit";

export default function RateLimitMonitor() {
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchStats = async () => {
    setLoading(true);
    setError("");

    try {
      const result = await getRateLimitStats();

      if (result.success) {
        setStats(result.stats);
      } else {
        setError(result.error || "통계 조회에 실패했습니다.");
      }
    } catch (error) {
      setError("통계 조회 중 오류가 발생했습니다.");
      console.error("Stats fetch error:", error);
    } finally {
      setLoading(false);
    }
  };

  const resetRateLimitAction = async (action, identifier) => {
    if (
      !confirm(`${identifier}의 ${action} rate limit을 초기화하시겠습니까?`)
    ) {
      return;
    }

    try {
      const result = await resetRateLimit(action, identifier);

      if (result.success) {
        alert("Rate limit이 초기화되었습니다.");
        fetchStats(); // 통계 새로고침
      } else {
        alert(result.error || "Rate limit 초기화에 실패했습니다.");
      }
    } catch (error) {
      alert("Rate limit 초기화 중 오류가 발생했습니다.");
      console.error("Reset error:", error);
    }
  };

  useEffect(() => {
    fetchStats();

    // 30초마다 자동 새로고침
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Rate Limit 모니터링</h1>
        <button
          onClick={fetchStats}
          className="btn btn-primary"
          disabled={loading}
        >
          {loading ? (
            <span className="loading loading-spinner loading-sm"></span>
          ) : (
            "새로고침"
          )}
        </button>
      </div>

      {error && (
        <div className="alert alert-error mb-4">
          <span>{error}</span>
        </div>
      )}

      {stats.length === 0 && !loading && !error && (
        <div className="alert alert-info">
          <span>현재 활성화된 rate limit이 없습니다.</span>
        </div>
      )}

      {stats.length > 0 && (
        <div className="overflow-x-auto">
          <table className="table table-zebra w-full">
            <thead>
              <tr>
                <th>IP/식별자</th>
                <th>액션</th>
                <th>요청 수</th>
                <th>남은 요청</th>
                <th>리셋 시간</th>
                <th>관리</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((stat, index) => (
                <tr key={index}>
                  <td className="font-mono text-sm">{stat.identifier}</td>
                  <td>
                    <span className="badge badge-outline">
                      {stat.actionName}
                    </span>
                  </td>
                  <td>
                    <span
                      className={`badge ${
                        stat.remaining === 0
                          ? "badge-error"
                          : stat.remaining < 3
                          ? "badge-warning"
                          : "badge-success"
                      }`}
                    >
                      {stat.count}
                    </span>
                  </td>
                  <td>
                    <span
                      className={`badge ${
                        stat.remaining === 0
                          ? "badge-error"
                          : stat.remaining < 3
                          ? "badge-warning"
                          : "badge-success"
                      }`}
                    >
                      {stat.remaining}
                    </span>
                  </td>
                  <td className="text-sm">
                    {new Date(stat.resetTime).toLocaleString("ko-KR")}
                  </td>
                  <td>
                    <button
                      onClick={() =>
                        resetRateLimitAction(stat.actionName, stat.identifier)
                      }
                      className="btn btn-sm btn-outline btn-error"
                    >
                      초기화
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-6 text-sm text-gray-500">
        <p>• 빨간색: 제한 초과</p>
        <p>• 노란색: 제한 근접 (3회 미만 남음)</p>
        <p>• 초록색: 정상</p>
        <p>• 자동 새로고침: 30초마다</p>
      </div>
    </div>
  );
}
