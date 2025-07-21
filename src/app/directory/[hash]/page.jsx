"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import FileUploader from "@/app/components/fileUploader";
import FileList from "@/app/components/fileList";
import CreateDirectory from "@/app/components/createDirectory";
import DirectoryShareModal from "@/app/components/directoryShareModal";
import { useAuth } from "@/context/AuthContext";
import { getDirectoryByHash } from "@/actions/directories";

export default function DirectoryPage() {
  const params = useParams();
  const router = useRouter();
  const { hash } = params;
  const { user, loading: authLoading, isAuthenticated } = useAuth();

  const [directory, setDirectory] = useState(null);
  const [directoryId, setDirectoryId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [breadcrumbs, setBreadcrumbs] = useState([]);

  // 디렉토리 공유 모달 상태
  const [directoryShareModal, setDirectoryShareModal] = useState({
    isOpen: false,
    directoryId: null,
    directoryName: "",
  });

  const fetchDirectoryDetails = useCallback(async (directoryHash) => {
    try {
      const result = await getDirectoryByHash({ hash: directoryHash });

      if (result.error) {
        throw new Error(result.error);
      }

      if (result.success) {
        setDirectory(result.directory);
        setDirectoryId(result.directory.id);
        setBreadcrumbs([]); // 해시로 접근하는 디렉토리는 breadcrumbs가 제한적
      }
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;

    if (!isAuthenticated) {
      router.push("/user/signin");
      return;
    }

    if (hash) {
      setLoading(true);
      setError("");
      fetchDirectoryDetails(hash);
    }
  }, [hash, isAuthenticated, authLoading, router, fetchDirectoryDetails]);

  const handleUploadComplete = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  const handleDirectoryCreated = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  // 디렉토리 공유 핸들러
  const handleShareDirectory = () => {
    if (directory) {
      setDirectoryShareModal({
        isOpen: true,
        directoryId: directory.id,
        directoryName: directory.name,
      });
    }
  };

  // 디렉토리 업데이트 핸들러 (공유 후 새로고침)
  const handleDirectoryUpdate = () => {
    if (hash) {
      fetchDirectoryDetails(hash);
    }
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

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold">{directory?.name}</h1>
          {directory && !directory.owner && directory.ownerInfo && (
            <div className="badge badge-accent gap-2">
              <span>👤</span>
              <span className="text-sm">
                {directory.ownerInfo.name || directory.ownerInfo.email}님이 공유
              </span>
            </div>
          )}
        </div>

        {directory && (
          <div className="flex items-center gap-2">
            <button onClick={() => router.back()} className="btn btn-ghost">
              ← 뒤로가기
            </button>
          </div>
        )}
      </div>

      {directory?.description && (
        <div className="bg-base-200 p-4 rounded-lg mb-6">
          <p className="text-gray-300">{directory.description}</p>
        </div>
      )}

      <div className="flex flex-wrap gap-4 mb-8 justify-between">
        <CreateDirectory
          parentId={directoryId}
          onSuccess={handleDirectoryCreated}
        />
        <button
          onClick={handleShareDirectory}
          className="btn btn-outline gap-2"
        >
          📤 디렉토리 공유
        </button>
      </div>

      <div className="mb-8">
        <FileUploader
          directoryId={directoryId}
          onUploadComplete={handleUploadComplete}
        />
      </div>

      <div>
        <FileList directoryId={directoryId} refreshTrigger={refreshTrigger} />
      </div>

      {/* 디렉토리 공유 모달 */}
      <DirectoryShareModal
        isOpen={directoryShareModal.isOpen}
        onClose={() =>
          setDirectoryShareModal({
            isOpen: false,
            directoryId: null,
            directoryName: "",
          })
        }
        directoryId={directoryShareModal.directoryId}
        directoryName={directoryShareModal.directoryName}
        onUpdate={handleDirectoryUpdate}
      />
    </div>
  );
}
