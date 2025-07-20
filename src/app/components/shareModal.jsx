"use client";

import { useState } from "react";
import { shareFile } from "@/actions/files";
import { shareDirectory } from "@/actions/directories";
import { toggleFilePublic } from "@/actions/share";

export default function ShareModal({
  file,
  directory,
  isOpen,
  onClose,
  onUpdate,
}) {
  const [email, setEmail] = useState("");
  const [permission, setPermission] = useState("read");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const item = file || directory;
  const isFile = !!file;

  const handleShare = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      let result;
      if (isFile) {
        result = await shareFile({
          fileId: file.id,
          email,
          permission,
        });
      } else {
        result = await shareDirectory({
          directoryId: directory.id,
          email,
          permission,
        });
      }

      if (result.error) {
        throw new Error(result.error);
      }

      setSuccess(`${email}에게 ${isFile ? "파일" : "폴더"}이 공유되었습니다.`);
      setEmail("");

      // 부모 컴포넌트에 업데이트 알림
      if (onUpdate) onUpdate();
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const togglePublic = async () => {
    if (!isFile) return; // 현재는 파일만 공개 설정 지원

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const result = await toggleFilePublic({ fileId: file.id });

      if (result.error) {
        throw new Error(result.error);
      }

      setSuccess(result.message);

      // 부모 컴포넌트에 업데이트 알림
      if (onUpdate) onUpdate();
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const copyShareUrl = () => {
    const shareUrl = `${window.location.origin}/share/${item.hash}`;
    navigator.clipboard.writeText(shareUrl);
    setSuccess("공유 링크가 클립보드에 복사되었습니다.");
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-base-100 rounded-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">
          {isFile ? "파일" : "폴더"} 공유
        </h2>

        {error && <div className="alert alert-error mb-4 text-sm">{error}</div>}
        {success && (
          <div className="alert alert-success mb-4 text-sm">{success}</div>
        )}

        {isFile && (
          <div className="mb-6">
            <h3 className="font-semibold mb-2">공개 링크</h3>

            {item?.isPublic ? (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    className="input input-bordered flex-grow text-sm"
                    value={`${window.location.origin}/share/${item.hash}`}
                    readOnly
                  />
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={copyShareUrl}
                  >
                    복사
                  </button>
                </div>
                <button
                  className="btn btn-outline btn-sm w-full"
                  onClick={togglePublic}
                  disabled={loading}
                >
                  공개 해제
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="text-sm bg-base-200 p-3 rounded-lg">
                  이 파일은 현재 비공개 상태입니다.
                </div>
                <button
                  className="btn btn-primary btn-sm w-full"
                  onClick={togglePublic}
                  disabled={loading}
                >
                  공개 설정
                </button>
              </div>
            )}
          </div>
        )}

        <div>
          <h3 className="font-semibold mb-2">이메일로 초대</h3>

          <form onSubmit={handleShare}>
            <div className="form-control">
              <input
                type="email"
                placeholder="이메일 주소"
                className="input input-bordered mb-2"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />

              <div className="flex gap-2 mb-4">
                <select
                  className="select select-bordered flex-grow"
                  value={permission}
                  onChange={(e) => setPermission(e.target.value)}
                  disabled={loading}
                >
                  <option value="read">읽기 권한</option>
                  <option value="write">쓰기 권한</option>
                  <option value="admin">관리 권한</option>
                </select>

                <button
                  type="submit"
                  className={`btn btn-primary ${loading ? "loading" : ""}`}
                  disabled={loading || !email}
                >
                  공유
                </button>
              </div>
            </div>
          </form>

          {item?.sharedWith && item.sharedWith.length > 0 && (
            <div>
              <h4 className="font-medium text-sm mb-2">공유된 사용자</h4>
              <ul className="text-sm">
                {item.sharedWith.map((share, index) => (
                  <li
                    key={index}
                    className="flex justify-between items-center py-1"
                  >
                    <span>{share.userId}</span>
                    <span className="badge badge-sm">
                      {share.permission === "admin"
                        ? "관리자"
                        : share.permission === "write"
                        ? "편집"
                        : "읽기"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="mt-6 text-right">
          <button className="btn btn-sm" onClick={onClose} disabled={loading}>
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
