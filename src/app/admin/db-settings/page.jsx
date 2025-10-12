"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { getDBConfig, updateDBConfig, testDBConnection } from "@/actions/dbSettings";

export default function DBSettingsPage() {
  const router = useRouter();
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(null);
  const [config, setConfig] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [selectedDB, setSelectedDB] = useState("auto");

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

    fetchConfig();
  }, [isAuthenticated, authLoading, user, router]);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      setError("");
      const result = await getDBConfig();

      if (result.error) {
        setError(result.error);
        return;
      }

      setConfig(result);
      setSelectedDB(result.settings.preferredDatabase);
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const result = await updateDBConfig({ preferredDatabase: selectedDB });

      if (result.error) {
        setError(result.error);
        return;
      }

      setSuccess(result.message);
      // Refresh config
      await fetchConfig();
    } catch (error) {
      setError(error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async (dbType) => {
    try {
      setTesting(dbType);
      setError("");
      setSuccess("");

      const result = await testDBConnection({ dbType });

      if (result.error) {
        setError(result.error);
      } else {
        setSuccess(result.message);
      }
    } catch (error) {
      setError(error.message);
    } finally {
      setTesting(null);
    }
  };

  if (authLoading || loading) {
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
          <h1 className="text-2xl sm:text-3xl font-bold">데이터베이스 설정</h1>
          <p className="text-gray-600 mt-1">사용할 데이터베이스를 선택하세요</p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin" className="btn btn-ghost btn-sm">
            ← 관리자 페이지
          </Link>
        </div>
      </div>

      {/* Error/Success Alert */}
      {error && (
        <div className="alert alert-error mb-6">
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="alert alert-success mb-6">
          <span>{success}</span>
        </div>
      )}

      {config && (
        <>
          {/* Current Status */}
          <div className="card bg-base-200 mb-6">
            <div className="card-body">
              <h2 className="card-title">현재 상태</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">현재 사용 중인 DB:</p>
                  <p className="text-lg font-bold">
                    {config.effectiveType === "postgresql" && "PostgreSQL"}
                    {config.effectiveType === "mongodb" && "MongoDB"}
                    {config.effectiveType === "none" && "설정되지 않음"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">설정된 모드:</p>
                  <p className="text-lg font-bold">
                    {config.settings.preferredDatabase === "auto" && "자동"}
                    {config.settings.preferredDatabase === "postgresql" && "PostgreSQL"}
                    {config.settings.preferredDatabase === "mongodb" && "MongoDB"}
                  </p>
                </div>
              </div>
              <div className="divider"></div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h3 className="font-bold mb-2 flex items-center gap-2">
                    PostgreSQL
                    {config.available.postgresql.configured && (
                      <span className="badge badge-success badge-sm">설정됨</span>
                    )}
                    {!config.available.postgresql.configured && (
                      <span className="badge badge-error badge-sm">미설정</span>
                    )}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {config.available.postgresql.configured
                      ? "DATABASE_URL이 환경 변수에 설정되어 있습니다."
                      : "DATABASE_URL이 환경 변수에 설정되어 있지 않습니다."}
                  </p>
                  {config.available.postgresql.configured && (
                    <button
                      className={`btn btn-sm btn-outline mt-2 ${testing === "postgresql" ? "loading" : ""}`}
                      onClick={() => handleTest("postgresql")}
                      disabled={testing !== null}
                    >
                      연결 테스트
                    </button>
                  )}
                </div>
                <div>
                  <h3 className="font-bold mb-2 flex items-center gap-2">
                    MongoDB
                    {config.available.mongodb.configured && (
                      <span className="badge badge-success badge-sm">설정됨</span>
                    )}
                    {!config.available.mongodb.configured && (
                      <span className="badge badge-error badge-sm">미설정</span>
                    )}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {config.available.mongodb.configured
                      ? "MONGODB_URI가 환경 변수에 설정되어 있습니다."
                      : "MONGODB_URI가 환경 변수에 설정되어 있지 않습니다."}
                  </p>
                  {config.available.mongodb.configured && (
                    <button
                      className={`btn btn-sm btn-outline mt-2 ${testing === "mongodb" ? "loading" : ""}`}
                      onClick={() => handleTest("mongodb")}
                      disabled={testing !== null}
                    >
                      연결 테스트
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Database Selection */}
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <h2 className="card-title">데이터베이스 선택</h2>
              <p className="text-sm text-gray-600 mb-4">
                애플리케이션에서 사용할 데이터베이스를 선택하세요.
                변경 사항은 즉시 적용됩니다.
              </p>

              <div className="form-control">
                <label className="label cursor-pointer">
                  <span className="label-text">
                    <div>
                      <p className="font-bold">자동 선택</p>
                      <p className="text-sm text-gray-600">
                        PostgreSQL이 설정되어 있으면 PostgreSQL 사용, 아니면 MongoDB 사용
                      </p>
                    </div>
                  </span>
                  <input
                    type="radio"
                    name="database"
                    className="radio checked:bg-primary"
                    value="auto"
                    checked={selectedDB === "auto"}
                    onChange={(e) => setSelectedDB(e.target.value)}
                  />
                </label>
              </div>

              <div className="divider"></div>

              <div className="form-control">
                <label className="label cursor-pointer">
                  <span className="label-text">
                    <div>
                      <p className="font-bold">PostgreSQL (권장)</p>
                      <p className="text-sm text-gray-600">
                        PostgreSQL 17 데이터베이스 사용 (Neon 호환)
                      </p>
                      {!config.available.postgresql.configured && (
                        <p className="text-sm text-error mt-1">
                          DATABASE_URL이 설정되지 않았습니다.
                        </p>
                      )}
                    </div>
                  </span>
                  <input
                    type="radio"
                    name="database"
                    className="radio checked:bg-primary"
                    value="postgresql"
                    checked={selectedDB === "postgresql"}
                    onChange={(e) => setSelectedDB(e.target.value)}
                    disabled={!config.available.postgresql.configured}
                  />
                </label>
              </div>

              <div className="divider"></div>

              <div className="form-control">
                <label className="label cursor-pointer">
                  <span className="label-text">
                    <div>
                      <p className="font-bold">MongoDB (레거시)</p>
                      <p className="text-sm text-gray-600">
                        MongoDB 데이터베이스 사용 (이전 버전)
                      </p>
                      {!config.available.mongodb.configured && (
                        <p className="text-sm text-error mt-1">
                          MONGODB_URI가 설정되지 않았습니다.
                        </p>
                      )}
                    </div>
                  </span>
                  <input
                    type="radio"
                    name="database"
                    className="radio checked:bg-primary"
                    value="mongodb"
                    checked={selectedDB === "mongodb"}
                    onChange={(e) => setSelectedDB(e.target.value)}
                    disabled={!config.available.mongodb.configured}
                  />
                </label>
              </div>

              <div className="card-actions justify-end mt-6">
                <button
                  className={`btn btn-primary ${saving ? "loading" : ""}`}
                  onClick={handleSave}
                  disabled={saving || selectedDB === config.settings.preferredDatabase}
                >
                  저장
                </button>
              </div>
            </div>
          </div>

          {/* Instructions */}
          <div className="alert alert-info mt-6">
            <div>
              <h3 className="font-bold">안내</h3>
              <ul className="list-disc list-inside mt-2 text-sm">
                <li>데이터베이스를 변경하면 즉시 적용됩니다.</li>
                <li>환경 변수에 DATABASE_URL이나 MONGODB_URI를 설정해야 사용할 수 있습니다.</li>
                <li>PostgreSQL을 사용하려면 .env 파일에 DATABASE_URL을 설정하세요.</li>
                <li>MongoDB를 사용하려면 .env 파일에 MONGODB_URI를 설정하세요.</li>
                <li>데이터 마이그레이션은 별도의 <Link href="/admin/migration" className="link">마이그레이션 페이지</Link>에서 진행하세요.</li>
              </ul>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
