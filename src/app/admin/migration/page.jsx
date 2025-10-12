"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import {
  initializePostgreSQLSchema,
  migrateUsers,
  migrateDirectories,
  migrateFiles,
  migrateRateLimits,
  migrateAllData,
  getMigrationStatus,
} from "@/lib/db/migration";

export default function MigrationPage() {
  const router = useRouter();
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (authLoading) return;

    if (!isAuthenticated) {
      router.push("/user/signin");
      return;
    }

    if (user?.role !== "admin") {
      router.push("/dashboard");
      return;
    }

    fetchStatus();
  }, [isAuthenticated, authLoading, user, router]);

  const fetchStatus = async () => {
    try {
      const statusResult = await getMigrationStatus();
      if (statusResult.error) {
        setError(statusResult.error);
      } else {
        setStatus(statusResult);
      }
    } catch (error) {
      setError(error.message);
    }
  };

  const handleInitSchema = async () => {
    setLoading(true);
    setResult(null);
    setError("");
    try {
      const res = await initializePostgreSQLSchema();
      setResult(res);
      if (res.success) {
        await fetchStatus();
      }
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleMigrateUsers = async () => {
    setLoading(true);
    setResult(null);
    setError("");
    try {
      const res = await migrateUsers();
      setResult(res);
      if (res.success) {
        await fetchStatus();
      }
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleMigrateDirectories = async () => {
    setLoading(true);
    setResult(null);
    setError("");
    try {
      const res = await migrateDirectories();
      setResult(res);
      if (res.success) {
        await fetchStatus();
      }
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleMigrateFiles = async () => {
    setLoading(true);
    setResult(null);
    setError("");
    try {
      const res = await migrateFiles();
      setResult(res);
      if (res.success) {
        await fetchStatus();
      }
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleMigrateRateLimits = async () => {
    setLoading(true);
    setResult(null);
    setError("");
    try {
      const res = await migrateRateLimits();
      setResult(res);
      if (res.success) {
        await fetchStatus();
      }
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleMigrateAll = async () => {
    if (!confirm("모든 데이터를 마이그레이션하시겠습니까? 이 작업은 시간이 걸릴 수 있습니다.")) {
      return;
    }

    setLoading(true);
    setResult(null);
    setError("");
    try {
      const res = await migrateAllData();
      setResult(res);
      if (res.success) {
        await fetchStatus();
      }
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center">
        <div className="loading loading-spinner loading-lg"></div>
        <p className="mt-4 text-lg">로딩 중...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">데이터베이스 마이그레이션</h1>
          <p className="text-gray-600 mt-1">MongoDB에서 PostgreSQL로 데이터 마이그레이션</p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin" className="btn btn-ghost btn-sm">
            ← 관리자 페이지
          </Link>
        </div>
      </div>

      {/* Status Card */}
      {status && (
        <div className="card bg-base-200 mb-6">
          <div className="card-body">
            <h2 className="card-title">현재 상태</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h3 className="font-bold mb-2">MongoDB</h3>
                {status.mongodbError ? (
                  <div className="alert alert-error alert-sm">
                    <span className="text-xs">{status.mongodbError}</span>
                  </div>
                ) : (
                  <ul className="space-y-1">
                    <li>사용자: {status.mongodb?.users || 0}명</li>
                    <li>디렉토리: {status.mongodb?.directories || 0}개</li>
                    <li>파일: {status.mongodb?.files || 0}개</li>
                    <li>Rate Limits: {status.mongodb?.rateLimits || 0}개</li>
                  </ul>
                )}
                <p className="text-xs text-gray-500 mt-2">
                  환경변수: {status.mongodbUri}
                </p>
              </div>
              <div>
                <h3 className="font-bold mb-2">PostgreSQL</h3>
                {status.postgresqlError ? (
                  <div className="alert alert-error alert-sm">
                    <span className="text-xs">{status.postgresqlError}</span>
                  </div>
                ) : (
                  <ul className="space-y-1">
                    <li>사용자: {status.postgresql?.users || 0}명</li>
                    <li>디렉토리: {status.postgresql?.directories || 0}개</li>
                    <li>파일: {status.postgresql?.files || 0}개</li>
                    <li>Rate Limits: {status.postgresql?.rate_limits || 0}개</li>
                  </ul>
                )}
                <p className="text-xs text-gray-500 mt-2">
                  환경변수: {status.databaseUrl}
                </p>
              </div>
            </div>
            <div className="card-actions justify-end mt-4">
              <button className="btn btn-sm btn-ghost" onClick={fetchStatus}>
                새로고침
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="alert alert-error mb-6">
          <span>{error}</span>
        </div>
      )}

      {/* Result Alert */}
      {result && (
        <div className={`alert ${result.success ? "alert-success" : "alert-error"} mb-6`}>
          <div className="flex-1">
            <span>{result.message || result.error}</span>
            {result.results && (
              <div className="mt-2 text-sm">
                {result.results.users && <div>- 사용자: {result.results.users.message}</div>}
                {result.results.directories && <div>- 디렉토리: {result.results.directories.message}</div>}
                {result.results.files && <div>- 파일: {result.results.files.message}</div>}
                {result.results.rateLimits && <div>- Rate Limits: {result.results.rateLimits.message}</div>}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Migration Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Schema Initialization */}
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title">1. 스키마 초기화</h2>
            <p className="text-sm text-gray-600">
              PostgreSQL 데이터베이스에 필요한 테이블과 인덱스를 생성합니다.
            </p>
            <div className="card-actions justify-end">
              <button
                className={`btn btn-primary ${loading ? "loading" : ""}`}
                onClick={handleInitSchema}
                disabled={loading}
              >
                스키마 초기화
              </button>
            </div>
          </div>
        </div>

        {/* Migrate Users */}
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title">2. 사용자 마이그레이션</h2>
            <p className="text-sm text-gray-600">
              MongoDB의 사용자 데이터를 PostgreSQL로 마이그레이션합니다.
            </p>
            <div className="card-actions justify-end">
              <button
                className={`btn btn-secondary ${loading ? "loading" : ""}`}
                onClick={handleMigrateUsers}
                disabled={loading}
              >
                사용자 마이그레이션
              </button>
            </div>
          </div>
        </div>

        {/* Migrate Directories */}
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title">3. 디렉토리 마이그레이션</h2>
            <p className="text-sm text-gray-600">
              MongoDB의 디렉토리 데이터를 PostgreSQL로 마이그레이션합니다.
            </p>
            <div className="card-actions justify-end">
              <button
                className={`btn btn-secondary ${loading ? "loading" : ""}`}
                onClick={handleMigrateDirectories}
                disabled={loading}
              >
                디렉토리 마이그레이션
              </button>
            </div>
          </div>
        </div>

        {/* Migrate Files */}
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title">4. 파일 마이그레이션</h2>
            <p className="text-sm text-gray-600">
              MongoDB의 파일 데이터를 PostgreSQL로 마이그레이션합니다.
            </p>
            <div className="card-actions justify-end">
              <button
                className={`btn btn-secondary ${loading ? "loading" : ""}`}
                onClick={handleMigrateFiles}
                disabled={loading}
              >
                파일 마이그레이션
              </button>
            </div>
          </div>
        </div>

        {/* Migrate Rate Limits */}
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title">5. Rate Limit 마이그레이션</h2>
            <p className="text-sm text-gray-600">
              MongoDB의 rate limit 데이터를 PostgreSQL로 마이그레이션합니다.
            </p>
            <div className="card-actions justify-end">
              <button
                className={`btn btn-secondary ${loading ? "loading" : ""}`}
                onClick={handleMigrateRateLimits}
                disabled={loading}
              >
                Rate Limit 마이그레이션
              </button>
            </div>
          </div>
        </div>

        {/* Migrate All */}
        <div className="card bg-base-100 shadow-xl border-2 border-primary">
          <div className="card-body">
            <h2 className="card-title text-primary">자동 전체 마이그레이션</h2>
            <p className="text-sm text-gray-600">
              모든 데이터를 한번에 마이그레이션합니다. (스키마 초기화 포함)
            </p>
            <div className="card-actions justify-end">
              <button
                className={`btn btn-primary ${loading ? "loading" : ""}`}
                onClick={handleMigrateAll}
                disabled={loading}
              >
                전체 마이그레이션
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="alert alert-info mt-6">
        <div>
          <h3 className="font-bold">마이그레이션 안내</h3>
          <ul className="list-disc list-inside mt-2 text-sm">
            <li>마이그레이션 전에 DATABASE_URL 환경 변수가 설정되어 있는지 확인하세요.</li>
            <li>수동 마이그레이션: 순서대로 1 → 2 → 3 → 4 → 5 단계를 진행하세요.</li>
            <li>자동 마이그레이션: 한번에 모든 단계를 자동으로 실행합니다.</li>
            <li>마이그레이션은 중복 실행해도 안전합니다 (ON CONFLICT 처리).</li>
            <li>마이그레이션 후 애플리케이션에서 DATABASE_URL을 사용하도록 설정하세요.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
