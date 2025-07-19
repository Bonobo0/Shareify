"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Navbar from "@/app/components/navbar";
import ShareModal from "@/app/components/shareModal";
import { useAuth } from "@/context/AuthContext";

export default function FilePage() {
  const params = useParams();
  const router = useRouter();
  const { hash } = params;
  const { user, loading: authLoading, isAuthenticated } = useAuth();

  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [isOwner, setIsOwner] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  useEffect(() => {
    if (authLoading) return;

    if (!isAuthenticated) {
      router.push("/user/signin");
      return;
    }

    if (hash) {
      fetchFileDetails();
    }
  }, [hash, isAuthenticated, authLoading, router]);

  const fetchFileDetails = async () => {
    try {
      const response = await fetch(`/api/files/details/${hash}`, {
        method: "GET",
        credentials: "include",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "파일 정보를 불러오는 중 오류가 발생했습니다."
        );
      }

      setFile(data.file);
      setIsPublic(data.file.isPublic);
      setIsOwner(data.file.owner);

      if (data.file.isPublic) {
        setShareUrl(`${window.location.origin}/share/${hash}`);
      }
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    try {
      const response = await fetch(`/api/files/download/${file.id}`, {
        method: "GET",
        credentials: "include",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "다운로드 URL을 생성하는 중 오류가 발생했습니다."
        );
      }

      window.open(data.downloadUrl, "_blank");
    } catch (error) {
      alert(error.message);
    }
  };

  const togglePublicAccess = async () => {
    if (!isOwner) return;

    try {
      const response = await fetch(`/api/files/access/${file.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          isPublic: !isPublic,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "파일 접근 권한을 변경하는 중 오류가 발생했습니다."
        );
      }

      setIsPublic(!isPublic);

      if (!isPublic) {
        setShareUrl(`${window.location.origin}/share/${hash}`);
      } else {
        setShareUrl("");
      }
    } catch (error) {
      alert(error.message);
    }
  };

  const formatBytes = (bytes, decimals = 2) => {
    if (!bytes) return "0 Bytes";

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
  };

  const formatDate = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const copyShareUrl = () => {
    navigator.clipboard.writeText(shareUrl);
    alert("공유 링크가 클립보드에 복사되었습니다.");
  };

  const deleteFile = async () => {
    if (!isOwner) return;

    if (!confirm("정말 이 파일을 삭제하시겠습니까?")) {
      return;
    }

    try {
      const response = await fetch(`/api/files/${file.id}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (response.ok) {
        alert("파일이 삭제되었습니다.");
        router.push("/dashboard");
      } else {
        const data = await response.json();
        throw new Error(data.error || "파일 삭제 중 오류가 발생했습니다.");
      }
    } catch (error) {
      alert(error.message);
    }
  };

  if (authLoading || loading) {
    return (
      <>
        <Navbar />
        <main className="flex min-h-screen flex-col items-center justify-center pt-20">
          <div className="loading loading-spinner loading-lg"></div>
        </main>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Navbar />
        <main className="flex min-h-screen flex-col p-8 pt-20">
          <div className="alert alert-error">{error}</div>
          <button
            className="btn btn-primary mt-4"
            onClick={() => router.push("/dashboard")}
          >
            대시보드로 돌아가기
          </button>
        </main>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <main className="flex min-h-screen flex-col p-4 md:p-8 pt-20">
        <div className="breadcrumbs mb-4">
          <ul>
            <li>
              <button onClick={() => router.push("/dashboard")}>내 파일</button>
            </li>
            <li>{file?.originalName}</li>
          </ul>
        </div>

        <div className="card bg-base-200 p-6">
          <h1 className="text-3xl font-bold mb-6">{file?.originalName}</h1>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <h2 className="text-lg font-semibold mb-2">파일 정보</h2>
              <ul className="space-y-2">
                <li>
                  <strong>크기:</strong> {formatBytes(file?.size)}
                </li>
                <li>
                  <strong>유형:</strong> {file?.mimetype}
                </li>
                <li>
                  <strong>업로드 일시:</strong> {formatDate(file?.createdAt)}
                </li>
              </ul>
            </div>

            {isOwner && (
              <div>
                <h2 className="text-lg font-semibold mb-2">액세스 설정</h2>
                <div className="form-control">
                  <label className="label cursor-pointer">
                    <span className="label-text">공개 액세스 허용</span>
                    <input
                      type="checkbox"
                      className="toggle toggle-primary"
                      checked={isPublic}
                      onChange={togglePublicAccess}
                    />
                  </label>
                </div>

                {isPublic && shareUrl && (
                  <div className="mt-4">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        className="input input-bordered flex-grow"
                        value={shareUrl}
                        readOnly
                      />
                      <button
                        className="btn btn-primary"
                        onClick={copyShareUrl}
                      >
                        복사
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <button className="btn btn-primary" onClick={handleDownload}>
              다운로드
            </button>

            <button
              className="btn btn-secondary"
              onClick={() => setIsShareModalOpen(true)}
            >
              공유하기
            </button>

            {isOwner && (
              <button className="btn btn-error" onClick={deleteFile}>
                삭제
              </button>
            )}

            <button
              className="btn btn-ghost"
              onClick={() => router.push("/dashboard")}
            >
              대시보드로 돌아가기
            </button>
          </div>
        </div>
      </main>

      <ShareModal
        file={file}
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
      />
    </>
  );
}
