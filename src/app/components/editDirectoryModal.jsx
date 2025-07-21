"use client";

import { useState, useEffect } from "react";
import { updateDirectory } from "@/actions/directories";

export default function EditDirectoryModal({
  isOpen,
  onClose,
  directoryId,
  directoryName,
  directoryDescription,
  onUpdate,
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setName(directoryName || "");
      setDescription(directoryDescription || "");
      setError("");
    }
  }, [isOpen, directoryName, directoryDescription]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!name.trim()) {
      setError("디렉토리 이름을 입력해주세요.");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const result = await updateDirectory({
        directoryId,
        name: name.trim(),
        description: description.trim(),
      });

      if (result.error) {
        throw new Error(result.error);
      }

      // 업데이트된 디렉토리 정보를 onUpdate에 전달
      onUpdate(result.directory);
      onClose();
    } catch (error) {
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-base-100 p-6 rounded-lg shadow-lg max-w-md w-full mx-4">
        <h3 className="text-lg font-bold mb-4">디렉토리 수정</h3>

        {error && (
          <div className="alert alert-error mb-4">
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-control mb-4">
            <label className="label">
              <span className="label-text">디렉토리 이름</span>
            </label>
            <input
              type="text"
              placeholder="디렉토리 이름"
              className="input input-bordered"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isLoading}
              autoFocus
            />
          </div>

          <div className="form-control mb-4">
            <label className="label">
              <span className="label-text">설명 (선택사항)</span>
            </label>
            <textarea
              placeholder="디렉토리 설명"
              className="textarea textarea-bordered"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <div className="modal-action">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={handleClose}
              disabled={isLoading}
            >
              취소
            </button>
            <button
              type="submit"
              className={`btn btn-primary ${isLoading ? "loading" : ""}`}
              disabled={isLoading}
            >
              수정
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
