"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteDirectoryRecursive } from "@/actions/directories";

export default function DeleteDirectory({ directoryId }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState("");

  const openModal = () => {
    setIsOpen(true);
    setError("");
  };

  const closeModal = () => {
    setIsOpen(false);
    setError("");
  };

  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      setError("");
      const result = await deleteDirectoryRecursive(directoryId);
      if (result.error) {
        setError(result.error);
        return;
      }
      closeModal();
      router.back();
    } catch (err) {
      setError("디렉토리 삭제 중 오류가 발생했습니다.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <button onClick={openModal} className="btn btn-error btn-md">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
          />
        </svg>{" "}
        삭제
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-base-100 p-6 rounded-lg shadow-xl max-w-md w-full">
            <h3 className="text-lg font-bold mb-4">디렉토리 삭제</h3>
            <p className="mb-6">
              이 디렉토리를 삭제하시겠습니까? 이 작업은 취소할 수 없습니다.
            </p>

            {error && (
              <div className="alert alert-error mb-4">
                <span>{error}</span>
              </div>
            )}

            <div className="flex justify-end gap-4">
              <button
                className="btn btn-ghost"
                onClick={closeModal}
                disabled={isDeleting}
              >
                취소
              </button>
              <button
                className="btn btn-error"
                onClick={handleDelete}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <>
                    <span className="loading loading-spinner"></span>
                    삭제 중...
                  </>
                ) : (
                  "삭제"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
