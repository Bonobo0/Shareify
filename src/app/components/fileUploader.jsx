"use client";

import { useState, useRef } from "react";

export default function FileUploader({ onUploadComplete, directoryId = null }) {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState({});
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);
  const [dragActive, setDragActive] = useState(false);

  const handleFileChange = (e) => {
    if (e.target.files.length > 0) {
      setFiles(Array.from(e.target.files));
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files.length > 0) {
      setFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      setError("업로드할 파일을 선택해주세요.");
      return;
    }

    setUploading(true);
    setError("");

    try {
      // 각 파일별로 업로드
      for (const file of files) {
        setProgress((prev) => ({
          ...prev,
          [file.name]: { percent: 0, status: "uploading" },
        }));

        // 1. 업로드 URL 요청
        const urlResponse = await fetch("/api/files/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include", // 쿠키 포함
          body: JSON.stringify({
            filename: file.name,
            size: file.size,
            mimetype: file.type,
            directoryId: directoryId,
          }),
        });

        if (!urlResponse.ok) {
          const errorData = await urlResponse.json();
          throw new Error(
            errorData.error || "업로드 URL 생성 중 오류가 발생했습니다."
          );
        }

        const urlData = await urlResponse.json();
        const { uploadUrl, fileId } = urlData;

        setProgress((prev) => ({
          ...prev,
          [file.name]: { percent: 10, status: "uploading" },
        }));

        // 2. presigned URL로 직접 파일 업로드
        const uploadResponse = await fetch(uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type },
          body: file,
          onUploadProgress: (progressEvent) => {
            if (progressEvent.lengthComputable) {
              const percentComplete =
                Math.round((progressEvent.loaded / progressEvent.total) * 80) +
                10;
              setProgress((prev) => ({
                ...prev,
                [file.name]: { percent: percentComplete, status: "uploading" },
              }));
            }
          },
        });

        if (!uploadResponse.ok) {
          throw new Error("파일 업로드 중 오류가 발생했습니다.");
        }

        // 3. 서버에 업로드 완료 알림
        const completeResponse = await fetch("/api/files/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include", // 쿠키 포함
          body: JSON.stringify({ fileId }),
        });

        if (!completeResponse.ok) {
          const errorData = await completeResponse.json();
          throw new Error(
            errorData.error || "업로드 완료 처리 중 오류가 발생했습니다."
          );
        }

        setProgress((prev) => ({
          ...prev,
          [file.name]: { percent: 100, status: "success" },
        }));
      }

      // 모든 파일 업로드 완료
      onUploadComplete();
      setFiles([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      setError(error.message);
    } finally {
      setUploading(false);
    }
  };

  const cancelUpload = () => {
    setFiles([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="card p-6 bg-base-200">
      <h2 className="text-xl font-bold mb-4">파일 업로드</h2>

      {error && (
        <div className="alert alert-error mb-4">
          <span>{error}</span>
        </div>
      )}

      <div
        className={`flex flex-col gap-4 ${
          dragActive
            ? "border-2 border-dashed border-primary p-4 rounded-lg"
            : ""
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            className="file-input w-full"
            multiple
            onChange={handleFileChange}
            disabled={uploading}
          />

          {files.length > 0 && !uploading && (
            <button
              className="btn btn-ghost"
              onClick={cancelUpload}
              title="선택 취소"
            >
              ✕
            </button>
          )}
        </div>

        {files.length === 0 && (
          <p className="text-center text-gray-500">
            파일을 선택하거나 이곳에 드래그하세요
          </p>
        )}

        {files.length > 0 && (
          <div>
            <h3 className="font-semibold mb-2">선택된 파일:</h3>
            <ul className="list-disc pl-5">
              {files.map((file, index) => (
                <li key={index} className="mb-2">
                  <div className="flex justify-between items-center">
                    <span>
                      {file.name} ({(file.size / 1024).toFixed(2)} KB)
                    </span>
                    {progress[file.name] && (
                      <span className="text-sm">
                        {progress[file.name].percent}%
                      </span>
                    )}
                  </div>

                  {progress[file.name] && (
                    <progress
                      className={`progress w-full ${
                        progress[file.name].status === "success"
                          ? "progress-success"
                          : "progress-primary"
                      }`}
                      value={progress[file.name].percent}
                      max="100"
                    ></progress>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        <button
          className={`btn btn-primary ${uploading ? "loading" : ""}`}
          onClick={handleUpload}
          disabled={uploading || files.length === 0}
        >
          {uploading ? "업로드 중..." : "업로드"}
        </button>
      </div>
    </div>
  );
}
