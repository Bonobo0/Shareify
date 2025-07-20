"use client";

import { useState, useRef } from "react";
import { uploadFile, completeFileUpload } from "@/actions/files";
import { encryptFile } from "@/lib/crypto/encryption";

export default function FileUploader({
  onUploadComplete,
  directoryId = null,
  shareHash = null,
}) {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState({});
  const [error, setError] = useState("");
  const [enableE2EE, setEnableE2EE] = useState(false);
  const [encryptionPassword, setEncryptionPassword] = useState("");
  const [showPasswordInput, setShowPasswordInput] = useState(false);
  const fileInputRef = useRef(null);
  const [dragActive, setDragActive] = useState(false);

  const handleFileChange = (e) => {
    if (e.target.files.length > 0) {
      const selectedFiles = Array.from(e.target.files);

      // E2EE 활성화 시 파일 크기 검증
      if (enableE2EE) {
        const MAX_ENCRYPT_SIZE = 100 * 1024 * 1024; // 100MB
        const oversizedFiles = selectedFiles.filter(
          (file) => file.size > MAX_ENCRYPT_SIZE
        );

        if (oversizedFiles.length > 0) {
          setError(
            `암호화 모드에서는 100MB 이하의 파일만 업로드할 수 있습니다. 큰 파일: ${oversizedFiles
              .map((f) => f.name)
              .join(", ")}`
          );
          return;
        }
      }

      setFiles(selectedFiles);
      setError(""); // 에러 메시지 클리어
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
      const selectedFiles = Array.from(e.dataTransfer.files);

      // E2EE 활성화 시 파일 크기 검증
      if (enableE2EE) {
        const MAX_ENCRYPT_SIZE = 100 * 1024 * 1024; // 100MB
        const oversizedFiles = selectedFiles.filter(
          (file) => file.size > MAX_ENCRYPT_SIZE
        );

        if (oversizedFiles.length > 0) {
          setError(
            `암호화 모드에서는 100MB 이하의 파일만 업로드할 수 있습니다. 큰 파일: ${oversizedFiles
              .map((f) => f.name)
              .join(", ")}`
          );
          return;
        }
      }

      setFiles(selectedFiles);
      setError(""); // 에러 메시지 클리어
    }
  };

  const handleE2EEToggle = (checked) => {
    setEnableE2EE(checked);
    if (checked) {
      setShowPasswordInput(true);

      // 이미 선택된 파일이 있다면 크기 검증
      if (files.length > 0) {
        const MAX_ENCRYPT_SIZE = 100 * 1024 * 1024; // 100MB
        const oversizedFiles = files.filter(
          (file) => file.size > MAX_ENCRYPT_SIZE
        );

        if (oversizedFiles.length > 0) {
          setError(
            `암호화 모드에서는 100MB 이하의 파일만 업로드할 수 있습니다. 큰 파일: ${oversizedFiles
              .map((f) => f.name)
              .join(", ")}`
          );
          // 큰 파일들 제거
          setFiles(files.filter((file) => file.size <= MAX_ENCRYPT_SIZE));
        }
      }
    } else {
      setShowPasswordInput(false);
      setEncryptionPassword("");
      setError(""); // 에러 메시지 클리어
    }
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      setError("업로드할 파일을 선택해주세요.");
      return;
    }

    if (enableE2EE && !encryptionPassword) {
      setError("암호화를 활성화했을 때는 암호화 키를 입력해주세요.");
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

        let fileToUpload = file;
        let originalMetadata = null;

        // E2EE가 활성화된 경우 파일 암호화
        if (enableE2EE) {
          setProgress((prev) => ({
            ...prev,
            [file.name]: { percent: 5, status: "encrypting" },
          }));

          console.log("파일 암호화 시작:", file.name);

          try {
            const encryptResult = await encryptFile(file, encryptionPassword);
            if (!encryptResult.success) {
              throw new Error(encryptResult.error);
            }

            fileToUpload = encryptResult.encryptedFile;
            originalMetadata = encryptResult.metadata;

            console.log(
              "파일 암호화 완료:",
              fileToUpload.name,
              fileToUpload.size
            );

            setProgress((prev) => ({
              ...prev,
              [file.name]: { percent: 15, status: "uploading" },
            }));
          } catch (encryptError) {
            console.error("암호화 실패:", encryptError);
            setProgress((prev) => ({
              ...prev,
              [file.name]: { percent: 0, status: "error" },
            }));
            throw new Error(`암호화 실패: ${encryptError.message}`);
          }
        }

        // 1. 업로드 URL 요청
        console.log("🚀 서버로 전송하는 데이터:", {
          filename: fileToUpload.name,
          size: fileToUpload.size,
          mimetype: fileToUpload.type,
          directoryId: directoryId,
          isEncrypted: enableE2EE,
          originalMetadata: originalMetadata,
        });

        const uploadResult = await uploadFile({
          filename: fileToUpload.name,
          size: fileToUpload.size,
          mimetype: fileToUpload.type,
          directoryId: directoryId,
          isEncrypted: enableE2EE,
          originalMetadata: originalMetadata,
          shareHash: shareHash,
        });

        if (uploadResult.error) {
          throw new Error(uploadResult.error);
        }

        const { uploadUrl, fileId } = uploadResult;

        setProgress((prev) => ({
          ...prev,
          [file.name]: { percent: enableE2EE ? 25 : 10, status: "uploading" },
        }));

        // 2. presigned URL로 직접 파일 업로드
        const uploadResponse = await fetch(uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": fileToUpload.type },
          body: fileToUpload,
        });

        if (!uploadResponse.ok) {
          throw new Error("파일 업로드 중 오류가 발생했습니다.");
        }

        setProgress((prev) => ({
          ...prev,
          [file.name]: { percent: 90, status: "uploading" },
        }));

        // 3. 서버에 업로드 완료 알림
        const completeResult = await completeFileUpload({ fileId });

        if (completeResult.error) {
          throw new Error(completeResult.error);
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
                    <div className="mt-1">
                      <div className="flex justify-between text-xs text-gray-600 mb-1">
                        <span>
                          {progress[file.name].status === "encrypting" &&
                            "🔒 암호화 중..."}
                          {progress[file.name].status === "uploading" &&
                            "📤 업로드 중..."}
                          {progress[file.name].status === "success" &&
                            "✅ 완료"}
                          {progress[file.name].status === "error" && "❌ 실패"}
                        </span>
                        <span>{progress[file.name].percent}%</span>
                      </div>
                      <progress
                        className={`progress w-full ${
                          progress[file.name].status === "success"
                            ? "progress-success"
                            : progress[file.name].status === "error"
                            ? "progress-error"
                            : progress[file.name].status === "encrypting"
                            ? "progress-warning"
                            : "progress-primary"
                        }`}
                        value={progress[file.name].percent}
                        max="100"
                      ></progress>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* E2EE 옵션 */}
        <div className="border-t pt-4">
          <div className="form-control">
            <label className="label cursor-pointer">
              <span className="label-text">
                <span className="font-semibold">종단간 암호화 (E2EE)</span>
                <br />
                <span className="text-sm text-gray-500">
                  파일이 디바이스에서 암호화되어 서버에 저장됩니다
                </span>
              </span>
              <input
                type="checkbox"
                className="toggle toggle-primary"
                checked={enableE2EE}
                onChange={(e) => handleE2EEToggle(e.target.checked)}
                disabled={uploading}
              />
            </label>
          </div>

          {showPasswordInput && (
            <div className="mt-3">
              <label className="label">
                <span className="label-text">암호화 키</span>
              </label>
              <input
                type="password"
                className="input input-bordered w-full"
                placeholder="암호화에 사용할 비밀번호를 입력하세요"
                value={encryptionPassword}
                onChange={(e) => setEncryptionPassword(e.target.value)}
                disabled={uploading}
              />
              <label className="label">
                <span className="label-text-alt text-warning">
                  ⚠️ 이 비밀번호를 잊으면 파일을 복구할 수 없습니다
                </span>
              </label>
            </div>
          )}
        </div>

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
