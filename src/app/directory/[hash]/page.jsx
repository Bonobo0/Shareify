"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import FileUploader from "@/app/components/fileUploader";
import FileList from "@/app/components/fileList";
import CreateDirectory from "@/app/components/createDirectory";
import { useAuth } from "@/context/AuthContext";

export default function DirectoryPage() {
  const params = useParams();
  const router = useRouter();
  const { hash } = params;
  const { user, loading: authLoading, isAuthenticated } = useAuth();

  const [directory, setDirectory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [breadcrumbs, setBreadcrumbs] = useState([]);

  useEffect(() => {
    if (authLoading) return;

    if (!isAuthenticated) {
      router.push("/user/signin");
      return;
    }

    if (hash) {
      fetchDirectoryDetails();
    }
  }, [hash, refreshTrigger, isAuthenticated, authLoading, router]);

  const fetchDirectoryDetails = async () => {
    try {
      const response = await fetch(`/api/directories/${hash}`, {
        credentials: "include",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(
          data.error || "디렉토리 정보를 가져오는 중 오류가 발생했습니다."
        );
      }

      const data = await response.json();
      setDirectory(data.directory);
      setBreadcrumbs(data.breadcrumbs || []);
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUploadComplete = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  const handleDirectoryCreated = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  if (authLoading || loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="loading loading-spinner loading-lg"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="alert alert-error mb-4">{error}</div>
        <button
          className="btn btn-primary"
          onClick={() => router.push("/dashboard")}
        >
          대시보드로 돌아가기
        </button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="breadcrumbs mb-4">
        <ul>
          <li>
            <Link href="/dashboard">내 파일</Link>
          </li>
          {breadcrumbs.map((crumb, index) => (
            <li key={crumb.id}>
              {index === breadcrumbs.length - 1 ? (
                crumb.name
              ) : (
                <Link href={`/directory/${crumb.hash}`}>{crumb.name}</Link>
              )}
            </li>
          ))}
        </ul>
      </div>

      <h1 className="text-3xl font-bold mb-6">{directory?.name}</h1>

      <div className="flex flex-wrap gap-4 mb-8">
        <CreateDirectory
          parentId={directory?.id}
          onSuccess={handleDirectoryCreated}
        />
      </div>

      <div className="mb-8">
        <FileUploader
          directoryId={directory?.id}
          onUploadComplete={handleUploadComplete}
        />
      </div>

      <div>
        <FileList directoryId={directory?.id} refreshTrigger={refreshTrigger} />
      </div>
    </div>
  );
}
