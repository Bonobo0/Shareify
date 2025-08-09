"use client";

import { useState } from "react";
import { createDirectory } from "@/actions/directories";

export default function CreateDirectory({
  parentId = null,
  onSuccess = () => {},
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const openModal = () => {
    setIsOpen(true);
    setName("");
    setDescription("");
    setError("");
  };

  const closeModal = () => {
    setIsOpen(false);
    setName("");
    setDescription("");
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!name.trim()) {
      setError("디렉토리 이름을 입력해주세요.");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const result = await createDirectory({
        name: name.trim(),
        parentId: parentId,
        description: description.trim(),
      });

      if (result.error) {
        throw new Error(result.error);
      }

      onSuccess(result.directory);
      closeModal();
    } catch (error) {
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <button onClick={openModal} className="btn btn-primary">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5 mr-2"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 6v6m0 0v6m0-6h6m-6 0H6"
          />
        </svg>
        새 디렉토리
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-base-100 p-6 rounded-lg shadow-lg max-w-md w-full">
            <h3 className="text-lg font-bold mb-4">새 디렉토리 만들기</h3>

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
                  placeholder="새 디렉토리 이름"
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
                  onClick={closeModal}
                  disabled={isLoading}
                >
                  취소
                </button>
                <button
                  type="submit"
                  className={`btn btn-primary ${isLoading ? "loading" : ""}`}
                  disabled={isLoading}
                >
                  생성
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
