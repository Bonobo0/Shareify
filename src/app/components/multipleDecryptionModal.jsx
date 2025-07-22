"use client";

import { useState } from "react";

export default function MultipleDecryptionModal({
  isOpen,
  onClose,
  encryptedFiles = [],
  onConfirm,
  title = "암호화 파일 복호화",
}) {
  const [passwords, setPasswords] = useState({});
  const [showPasswords, setShowPasswords] = useState({});
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const handlePasswordChange = (fileId, password) => {
    setPasswords((prev) => ({
      ...prev,
      [fileId]: password,
    }));

    // 에러 클리어
    if (errors[fileId]) {
      setErrors((prev) => ({
        ...prev,
        [fileId]: null,
      }));
    }
  };

  const togglePasswordVisibility = (fileId) => {
    setShowPasswords((prev) => ({
      ...prev,
      [fileId]: !prev[fileId],
    }));
  };

  const handleConfirm = async () => {
    setLoading(true);
    setErrors({});

    // 모든 암호화 파일에 대해 비밀번호가 입력되었는지 확인
    const missingPasswords = encryptedFiles.filter(
      (file) => !passwords[file.id]
    );

    if (missingPasswords.length > 0) {
      const newErrors = {};
      missingPasswords.forEach((file) => {
        newErrors[file.id] = "비밀번호를 입력해주세요.";
      });
      setErrors(newErrors);
      setLoading(false);
      return;
    }

    try {
      // 파일별 비밀번호 맵을 전달
      await onConfirm(passwords);
      handleClose();
    } catch (error) {
      console.error("복호화 오류:", error);
      setLoading(false);
    }
  };

  const handleClose = () => {
    setPasswords({});
    setShowPasswords({});
    setErrors({});
    setLoading(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-base-100 p-6 rounded-lg shadow-lg max-w-3xl w-full mx-4 max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-bold">{title}</h3>
          <button
            onClick={handleClose}
            className="btn btn-ghost btn-sm"
            disabled={loading}
          >
            ✕
          </button>
        </div>

        <div className="alert alert-info mb-6">
          <div className="flex items-center gap-2">
            <span>🔐</span>
            <div>
              <div className="font-semibold">
                암호화된 파일별 복호화 키 입력
              </div>
              <div className="text-sm">
                각 암호화된 파일마다 다른 비밀번호를 입력할 수 있습니다. 모든
                파일에 대해 비밀번호를 입력해주세요.
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4 mb-6">
          {encryptedFiles.map((file, index) => (
            <div key={file.id} className="border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-warning">🔐</span>
                <div className="flex-1">
                  <div className="font-medium text-sm">
                    {file.originalName || file.name}
                  </div>
                  <div className="text-xs text-gray-500">
                    크기:{" "}
                    {file.size
                      ? `${(file.size / 1024 / 1024).toFixed(2)} MB`
                      : "Unknown"}
                  </div>
                </div>
              </div>

              <div className="relative">
                <input
                  type={showPasswords[file.id] ? "text" : "password"}
                  className={`input input-bordered w-full pr-12 ${
                    errors[file.id] ? "input-error" : ""
                  }`}
                  placeholder="복호화 비밀번호 입력"
                  value={passwords[file.id] || ""}
                  onChange={(e) =>
                    handlePasswordChange(file.id, e.target.value)
                  }
                  disabled={loading}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover: "
                  onClick={() => togglePasswordVisibility(file.id)}
                  disabled={loading}
                >
                  {showPasswords[file.id] ? "🙈" : "👁️"}
                </button>
              </div>

              {errors[file.id] && (
                <div className="text-error text-sm mt-1">{errors[file.id]}</div>
              )}
            </div>
          ))}
        </div>

        <div className="alert alert-warning mb-6">
          <div className="flex items-center gap-2">
            <span>⚠️</span>
            <div className="text-sm">
              <div className="font-semibold">보안 주의사항</div>
              <ul className="list-disc list-inside mt-1 space-y-1">
                <li>비밀번호는 암호화된 연결을 통해 전송됩니다</li>
                <li>비밀번호는 브라우저에 저장되지 않습니다</li>
                <li>잘못된 비밀번호 입력 시 파일이 손상될 수 있습니다</li>
                <li>비밀번호를 정확히 입력했는지 확인해주세요</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="flex gap-2 justify-end">
          <button
            onClick={handleClose}
            className="btn btn-ghost"
            disabled={loading}
          >
            취소
          </button>
          <button
            onClick={handleConfirm}
            className={`btn btn-primary ${loading ? "loading" : ""}`}
            disabled={loading || encryptedFiles.length === 0}
          >
            {loading ? "처리 중..." : "복호화 시작"}
          </button>
        </div>
      </div>
    </div>
  );
}
