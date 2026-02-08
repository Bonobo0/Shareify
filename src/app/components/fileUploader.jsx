"use client";

import { useState, useRef } from "react";
import { uploadFile, completeFileUpload } from "@/actions/files";
import { encryptFile } from "@/lib/crypto/encryption";
import { validateWebGLBuildFile } from "@/lib/webgl/validation";
import FileProgressList from "./fileUploader/FileProgressList";
import UploadOptions from "./fileUploader/UploadOptions";

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
  const [uploadResults, setUploadResults] = useState({}); // 업로드 결과 추적
  const [retryMode, setRetryMode] = useState(false); // 재시도 모드
  const fileInputRef = useRef(null);
  const [dragActive, setDragActive] = useState(false);
  const [isWebGLBuild, setIsWebGLBuild] = useState(false); // WebGL 빌드 여부

  const handleFileChange = (e) => {
    if (e.target.files.length > 0) {
      const selectedFiles = Array.from(e.target.files);
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
      setFiles(selectedFiles);
      setError(""); // 에러 메시지 클리어
    }
  };

  const handleE2EEToggle = (checked) => {
    setEnableE2EE(checked);
    if (checked) {
      setShowPasswordInput(true);
    } else {
      setShowPasswordInput(false);
      setEncryptionPassword("");
      setError(""); // 에러 메시지 클리어
    }
  };

  const handleUpload = async (isRetry = false) => {
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

    // 재시도 모드일 때는 실패한 파일만 업로드
    const filesToUpload = isRetry
      ? files.filter(
          (file) =>
            !uploadResults[file.name] ||
            uploadResults[file.name].status === "error"
        )
      : files;

    if (filesToUpload.length === 0 && isRetry) {
      setError("재시도할 파일이 없습니다. 모든 파일이 이미 업로드되었습니다.");
      setUploading(false);
      return;
    }

    let hasErrors = false;

    try {
      // 각 파일별로 업로드
      for (const file of filesToUpload) {
        // 이미 성공한 파일은 건너뛰기
        if (uploadResults[file.name]?.status === "success") {
          continue;
        }

        try {
          setProgress((prev) => ({
            ...prev,
            [file.name]: { percent: 0, status: "uploading" },
          }));

          // WebGL 빌드 검증 (WebGL로 표시된 경우, 암호화 전에 검증)
          if (isWebGLBuild) {
            setProgress((prev) => ({
              ...prev,
              [file.name]: { percent: 2, status: "validating" },
            }));

            console.log("WebGL 빌드 검증 시작:", file.name);
            
            const validationResult = await validateWebGLBuildFile(file);
            
            if (!validationResult.isValid) {
              throw new Error(
                validationResult.error || "유효한 WebGL 빌드가 아닙니다."
              );
            }
            
            console.log("WebGL 빌드 검증 완료:", file.name);
          }

          let fileToUpload = file;
          let originalMetadata = null;

          // E2EE가 활성화된 경우 파일 암호화
          if (enableE2EE) {
            setProgress((prev) => ({
              ...prev,
              [file.name]: { percent: 5, status: "encrypting" },
            }));

            console.log("파일 암호화 시작:", file.name);

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
          }

          // 1. 업로드 URL 요청
          console.log("🚀 서버로 전송하는 데이터:", {
            filename: fileToUpload.name,
            size: fileToUpload.size,
            mimetype: fileToUpload.type == "" ? "application/octet-stream" : fileToUpload.type,
            directoryId: directoryId,
            isEncrypted: enableE2EE,
            originalMetadata: originalMetadata,
            isWebGLBuild: isWebGLBuild,
          });

          const uploadResult = await uploadFile({
            filename: fileToUpload.name,
            size: fileToUpload.size,
            mimetype: fileToUpload.type == "" ? "application/octet-stream" : fileToUpload.type,
            directoryId: directoryId,
            isEncrypted: enableE2EE,
            originalMetadata: originalMetadata,
            shareHash: shareHash,
            isWebGLBuild: isWebGLBuild,
          });

          if (uploadResult.error) {
            throw new Error(uploadResult.error);
          }

          const { uploadUrl, fileId } = uploadResult;

          setProgress((prev) => ({
            ...prev,
            [file.name]: { percent: enableE2EE ? 25 : 10, status: "uploading" },
          }));

          // 2. presigned URL로 직접 파일 업로드 (XMLHttpRequest 사용)
          const uploadResponse = await new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();

            xhr.upload.addEventListener("progress", (event) => {
              if (event.lengthComputable) {
                // E2EE가 활성화된 경우 25-90%, 비활성화된 경우 10-90% 범위로 진행률 매핑
                const baseProgress = enableE2EE ? 25 : 10;
                const progressPercent =
                  baseProgress +
                  Math.round(
                    (event.loaded / event.total) * (90 - baseProgress)
                  );

                setProgress((prev) => ({
                  ...prev,
                  [file.name]: {
                    percent: progressPercent,
                    status: "uploading",
                    loaded: event.loaded,
                    total: event.total,
                  },
                }));
              }
            });

            xhr.addEventListener("load", () => {
              if (xhr.status >= 200 && xhr.status < 300) {
                resolve({ ok: true });
              } else {
                reject(
                  new Error(`파일 업로드 실패: ${xhr.status} ${xhr.statusText}`)
                );
              }
            });

            xhr.addEventListener("error", () => {
              reject(new Error("파일 업로드 중 네트워크 오류가 발생했습니다."));
            });

            xhr.addEventListener("abort", () => {
              reject(new Error("파일 업로드가 취소되었습니다."));
            });

            xhr.open("PUT", uploadUrl);
            xhr.setRequestHeader("Content-Type", fileToUpload.type);
            xhr.send(fileToUpload);
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

          // 업로드 결과 저장
          setUploadResults((prev) => ({
            ...prev,
            [file.name]: { status: "success", fileId },
          }));
        } catch (fileError) {
          console.error(`파일 ${file.name} 업로드 실패:`, fileError);
          hasErrors = true;

          setProgress((prev) => ({
            ...prev,
            [file.name]: {
              percent: 0,
              status: "error",
              error: fileError.message,
            },
          }));

          // 업로드 결과 저장
          setUploadResults((prev) => ({
            ...prev,
            [file.name]: { status: "error", error: fileError.message },
          }));

          // 개별 파일 오류는 전체 업로드를 중단하지 않음
          continue;
        }
      }

      // 모든 파일 처리 완료 후
      if (!hasErrors) {
        // 모든 파일이 성공한 경우에만 초기화
        onUploadComplete();
        setFiles([]);
        setUploadResults({});
        setRetryMode(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      } else {
        // 일부 파일이 실패한 경우
        setRetryMode(true);
        setError(
          "일부 파일 업로드에 실패했습니다. 실패한 파일을 다시 시도할 수 있습니다."
        );
      }
    } catch (error) {
      console.error("업로드 중 예상치 못한 오류:", error);
      setError(error.message);
      hasErrors = true;
    } finally {
      setUploading(false);
    }
  };

  // 재시도 핸들러
  const handleRetry = () => {
    handleUpload(true);
  };

  const cancelUpload = () => {
    setFiles([]);
    setUploadResults({});
    setRetryMode(false);
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
          <FileProgressList files={files} progress={progress} />
        )}

        {/* E2EE 및 WebGL 옵션 */}
        <UploadOptions
          enableE2EE={enableE2EE}
          onE2EEToggle={handleE2EEToggle}
          showPasswordInput={showPasswordInput}
          encryptionPassword={encryptionPassword}
          onPasswordChange={setEncryptionPassword}
          isWebGLBuild={isWebGLBuild}
          onWebGLToggle={setIsWebGLBuild}
          uploading={uploading}
        />

        <div className="flex gap-2">
          <button
            className={`btn btn-primary ${uploading ? "loading" : ""}`}
            onClick={() => handleUpload(false)}
            disabled={uploading || files.length === 0}
          >
            {uploading ? "업로드 중..." : "업로드"}
          </button>

          {retryMode && !uploading && (
            <button className="btn btn-warning" onClick={handleRetry}>
              🔄 실패한 파일 재시도
            </button>
          )}

          {retryMode && !uploading && (
            <button className="btn btn-ghost" onClick={cancelUpload}>
              모두 취소
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
