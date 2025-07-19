"use client";

import { useState } from "react";

export default function ShareModal({ file, isOpen, onClose }) {
  const [email, setEmail] = useState("");
  const [permission, setPermission] = useState("read");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleShare = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    const token = localStorage.getItem("token");

    try {
      const response = await fetch(`/api/files/share/${file.id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          email,
          permission,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "파일 공유 중 오류가 발생했습니다.");
      }

      setSuccess(`${email}에게 파일이 공유되었습니다.`);
      setEmail("");
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const copyShareUrl = () => {
    const shareUrl = `${window.location.origin}/share/${file.hash}`;
    navigator.clipboard.writeText(shareUrl);
    setSuccess("공유 링크가 클립보드에 복사되었습니다.");
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-base-100 rounded-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">파일 공유</h2>

        {error && <div className="alert alert-error mb-4 text-sm">{error}</div>}
        {success && (
          <div className="alert alert-success mb-4 text-sm">{success}</div>
        )}

        <div className="mb-6">
          <h3 className="font-semibold mb-2">공개 링크</h3>

          {file?.isPublic ? (
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                className="input input-bordered flex-grow text-sm"
                value={`${window.location.origin}/share/${file.hash}`}
                readOnly
              />
              <button className="btn btn-primary btn-sm" onClick={copyShareUrl}>
                복사
              </button>
            </div>
          ) : (
            <div className="text-sm bg-base-200 p-3 rounded-lg">
              이 파일은 현재 비공개 상태입니다. 파일 상세 페이지에서 공개 설정을
              변경할 수 있습니다.
            </div>
          )}
        </div>

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
              />

              <div className="flex gap-2 mb-4">
                <select
                  className="select select-bordered flex-grow"
                  value={permission}
                  onChange={(e) => setPermission(e.target.value)}
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

          {file?.shared && file.shared.length > 0 && (
            <div>
              <h4 className="font-medium text-sm mb-2">공유된 사용자</h4>
              <ul className="text-sm">
                {file.shared.map((share, index) => (
                  <li
                    key={index}
                    className="flex justify-between items-center py-1"
                  >
                    <span>{share.email}</span>
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
          <button className="btn btn-sm" onClick={onClose}>
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
