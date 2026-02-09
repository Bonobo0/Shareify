"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import FileUploader from "@/app/components/fileUploader";
import FileList from "@/app/components/fileList";
import CreateDirectory from "@/app/components/createDirectory";
import DeleteDirectory from "@/app/components/deleteDirectory";
import DirectoryShareModal from "@/app/components/directoryShareModal";
import EditDirectoryModal from "@/app/components/editDirectoryModal";
import BulkDownloadModal from "@/app/components/bulkDownloadModal";
import { useAuth } from "@/context/AuthContext";
import { getDirectoryByHash } from "@/actions/directories";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUser, faPenToSquare, faBox, faUpload } from "@fortawesome/free-solid-svg-icons";

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
  const [userPermission, setUserPermission] = useState(null);

  // 디렉토리 공유 모달 상태
  const [directoryShareModal, setDirectoryShareModal] = useState({
    isOpen: false,
    directoryId: null,
    directoryName: "",
  });

  // 디렉토리 수정 모달 상태
  const [editDirectoryModal, setEditDirectoryModal] = useState({
    isOpen: false,
    directoryId: null,
    directoryName: "",
    directoryDescription: "",
  });

  // 전체 다운로드 모달 상태
  const [bulkDownloadModal, setBulkDownloadModal] = useState({
    isOpen: false,
    directoryId: null,
    directoryName: "",
  });

  const fetchDirectoryDetails = useCallback(
    async (directoryHash) => {
      try {
        const result = await getDirectoryByHash({ hash: directoryHash });

        if (result.error) {
          throw new Error(result.error);
        }

        if (result.success) {
          setDirectory(result.directory);
          setDirectoryId(result.directory.id);
          setBreadcrumbs([]); // 해시로 접근하는 디렉토리는 breadcrumbs가 제한적

          // 사용자 권한 확인
          if (result.directory.owner) {
            setUserPermission("owner");
          } else if (
            result.directory.sharedWith &&
            result.directory.sharedWith.length > 0
          ) {
            // 공유받은 디렉토리인 경우 권한 확인
            const currentUserShare = result.directory.sharedWith.find(
              (share) => share.userId === user?.id
            );
            setUserPermission(currentUserShare?.permission || "read");
          } else {
            setUserPermission("read");
          }
        }
      } catch (error) {
        setError(error.message);
      } finally {
        setLoading(false);
      }
    },
    [user?.id]
  );

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

  // 디렉토리 수정 핸들러
  const handleEditDirectory = () => {
    if (directory) {
      setEditDirectoryModal({
        isOpen: true,
        directoryId: directory.id,
        directoryName: directory.name,
        directoryDescription: directory.description || "",
      });
    }
  };

  // 전체 다운로드 핸들러
  const handleBulkDownload = () => {
    if (directory) {
      setBulkDownloadModal({
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
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
      <div className="breadcrumbs mb-4 text-sm">
        <ul className="flex-wrap">
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

      <div className="flex flex-col sm:flex-row sm:items-start justify-between mb-6 gap-4">
        <div className="flex flex-col gap-2 min-w-0 flex-1">
          <h1 className="text-2xl sm:text-3xl font-bold break-words">
            {directory?.name}
          </h1>
          {directory && !directory.owner && directory.ownerInfo && (
            <div className="badge badge-accent gap-2 w-fit">
              <span><FontAwesomeIcon icon={faUser} /></span>
              <span className="text-xs sm:text-sm">
                {directory.ownerInfo.name || directory.ownerInfo.email}님이 공유
              </span>
            </div>
          )}
        </div>

        {directory && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => router.back()}
              className="btn btn-ghost btn-sm sm:btn-md"
            >
              <span className="hidden sm:inline">← 뒤로가기</span>
              <span className="sm:hidden">←</span>
            </button>
          </div>
        )}
      </div>

      {directory?.description && (
        <div className="bg-base-200 p-4 rounded-lg mb-6">
          <p className="text-gray-300">{directory.description}</p>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-4 mb-8 justify-between">
        {/* Directory creation - show only if user has write/admin permissions */}
        {
          <div className="flex gap-2">
            {(userPermission === "owner" ||
              userPermission === "write" ||
              userPermission === "admin") && (
              <CreateDirectory
                parentId={directoryId}
                onSuccess={handleDirectoryCreated}
              />
            )}
            {(userPermission === "owner" || userPermission === "admin") && (
              <DeleteDirectory directoryId={directoryId} />
            )}
          </div>
        }

        <div className="flex flex-col sm:flex-row gap-2 sm:gap-2">
          {directory && directory.owner && (
            <button
              onClick={handleEditDirectory}
              className="btn btn-primary gap-2 text-sm sm:text-base px-3 sm:px-4"
            >
              <span className="hidden sm:inline"><FontAwesomeIcon icon={faPenToSquare} /></span>
              <span className="sm:hidden"><FontAwesomeIcon icon={faPenToSquare} /></span>
              <span className="hidden sm:inline">수정하기</span>
              <span className="sm:hidden">수정</span>
            </button>
          )}
          <button
            onClick={handleBulkDownload}
            className="btn btn-outline gap-2 text-sm sm:text-base px-3 sm:px-4"
          >
            <span className="hidden sm:inline"><FontAwesomeIcon icon={faBox} /></span>
            <span className="sm:hidden"><FontAwesomeIcon icon={faBox} /></span>
            <span className="hidden sm:inline">전체 다운로드</span>
            <span className="sm:hidden">다운로드</span>
          </button>
          <button
            onClick={handleShareDirectory}
            className="btn btn-outline gap-2 text-sm sm:text-base px-3 sm:px-4"
          >
            <span className="hidden sm:inline"><FontAwesomeIcon icon={faUpload} /></span>
            <span className="sm:hidden"><FontAwesomeIcon icon={faUpload} /></span>
            <span className="hidden sm:inline">디렉토리 공유</span>
            <span className="sm:hidden">공유</span>
          </button>
        </div>
      </div>

      {/* File uploader - show only if user has write/admin permissions */}
      {(userPermission === "owner" ||
        userPermission === "write" ||
        userPermission === "admin") && (
        <div className="mb-8">
          <FileUploader
            directoryId={directoryId}
            onUploadComplete={handleUploadComplete}
          />
        </div>
      )}

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

      {/* 디렉토리 수정 모달 */}
      <EditDirectoryModal
        isOpen={editDirectoryModal.isOpen}
        onClose={() =>
          setEditDirectoryModal({
            isOpen: false,
            directoryId: null,
            directoryName: "",
            directoryDescription: "",
          })
        }
        directoryId={editDirectoryModal.directoryId}
        directoryName={editDirectoryModal.directoryName}
        directoryDescription={editDirectoryModal.directoryDescription}
        onUpdate={handleDirectoryUpdate}
      />

      {/* 전체 다운로드 모달 */}
      <BulkDownloadModal
        isOpen={bulkDownloadModal.isOpen}
        onClose={() =>
          setBulkDownloadModal({
            isOpen: false,
            directoryId: null,
            directoryName: "",
          })
        }
        directoryId={bulkDownloadModal.directoryId}
        directoryName={bulkDownloadModal.directoryName}
      />
    </div>
  );
}
