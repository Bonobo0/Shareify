"use client";

import { useState } from "react";

export default function DecryptionPasswordModal({
  isOpen,
  onClose,
  onConfirm,
  encryptedFileCount = 0,
  title = "암호화 파일 복호화",
}) {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!password.trim()) {
      setError("비밀번호를 입력해주세요.");
      return;
    }

    onConfirm(password.trim());
  };

  const handleClose = () => {
    setPassword("");
    setError("");
    setShowPassword(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-base-100 p-6 rounded-lg shadow-lg max-w-md w-full mx-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold">{title}</h3>
          <button onClick={handleClose} className="btn btn-ghost btn-sm">
            ✕
          </button>
        </div>

        <div className="mb-4">
          <div className="alert alert-info">
            <div className="flex items-center gap-2">
              <span>🔐</span>
              <div>
                <div className="font-semibold">
                  암호화된 파일이 포함되어 있습니다
                </div>
                <div className="text-sm">
                  {encryptedFileCount}개의 암호화된 파일을 복호화하기 위해
                  비밀번호가 필요합니다.
                </div>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="alert alert-error mb-4">
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-control mb-4">
            <label className="label">
              <span className="label-text">복호화 비밀번호</span>
            </label>
            <div className="input-group">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="파일 암호화에 사용된 비밀번호를 입력하세요"
                className="input input-bordered flex-1"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError("");
                }}
                autoFocus
              />
              <button
                type="button"
                className="btn btn-square btn-outline"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? "🙈" : "👁️"}
              </button>
            </div>
          </div>

          <div className="alert alert-warning mb-4">
            <div className="text-sm">
              <div className="font-semibold">⚠️ 주의사항</div>
              <ul className="list-disc list-inside mt-1 space-y-1">
                <li>모든 암호화된 파일에 동일한 비밀번호가 사용됩니다</li>
                <li>
                  잘못된 비밀번호로 인해 복호화에 실패한 파일은 제외됩니다
                </li>
                <li>비밀번호는 서버에 저장되지 않습니다</li>
              </ul>
            </div>
          </div>

          <div className="modal-action">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={handleClose}
            >
              취소
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!password.trim()}
            >
              복호화 시작
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
