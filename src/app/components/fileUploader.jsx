"use client";

import { useState, useRef } from "react";
import { uploadFile, completeFileUpload } from "@/actions/files";
import {
  encryptFile,
  validatePasswordStrength,
} from "@/lib/crypto/encryption";
import { validateWebGLBuildFile } from "@/lib/webgl/validation";
import FileProgressList from "./fileUploader/FileProgressList";
import UploadOptions from "./fileUploader/UploadOptions";
import {
  createEmptyUploadQueueState,
  getFilesToUpload,
  getUploadQueueStateForSelection,
  getUploadFileKey,
} from "./fileUploader/uploadQueue.mjs";
import { aiUploadComplete } from "@/app/actions/ai";
import useSearchStore from "@/app/stores/searchStore";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowsRotate,
  faXmark,
  faCloudArrowUp,
} from "@fortawesome/free-solid-svg-icons";

export default function FileUploader({
  onUploadComplete,
  directoryId = null,
  shareHash = null,
}) {
  const addIndexingFile = useSearchStore((s) => s.addIndexingFile);
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState({});
  const [error, setError] = useState("");
  const [enableE2EE, setEnableE2EE] = useState(false);
  const [encryptionPassword, setEncryptionPassword] = useState("");
  const [showPasswordInput, setShowPasswordInput] = useState(false);
  const [uploadResults, setUploadResults] = useState({});
  const [retryMode, setRetryMode] = useState(false);
  const fileInputRef = useRef(null);
  const uploadingRef = useRef(false);
  const [dragActive, setDragActive] = useState(false);
  const [isWebGLBuild, setIsWebGLBuild] = useState(false);

  const resetUploadQueueState = () => {
    const emptyQueue = createEmptyUploadQueueState();
    setProgress(emptyQueue.progress);
    setUploadResults(emptyQueue.uploadResults);
    setRetryMode(emptyQueue.retryMode);
  };

  const replaceUploadQueue = (selectedFiles) => {
    const nextQueue = getUploadQueueStateForSelection(
      selectedFiles,
      uploadingRef.current,
    );
    if (!nextQueue) return false;

    setFiles(nextQueue.files);
    setProgress(nextQueue.progress);
    setUploadResults(nextQueue.uploadResults);
    setRetryMode(nextQueue.retryMode);
    return true;
  };

  const handleFileChange = (e) => {
    if (e.target.files.length > 0) {
      const selectedFiles = Array.from(e.target.files);
      // A new selection starts a new queue. Status must not leak into files
      // with the same name from a previous selection.
      if (replaceUploadQueue(selectedFiles)) setError("");
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (uploadingRef.current) {
      setDragActive(false);
      return;
    }

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
      // A new selection starts a new queue. Status must not leak into files
      // with the same name from a previous selection.
      if (replaceUploadQueue(selectedFiles)) setError("");
    }
  };

  const [isValidPassword, setIsValidPassword] = useState(false);

  const handlePasswordValidation = (isValid) => {
    setIsValidPassword(isValid);
  };

  const handleE2EEToggle = (checked) => {
    setEnableE2EE(checked);
    if (checked) {
      setShowPasswordInput(true);
    } else {
      setShowPasswordInput(false);
      setEncryptionPassword("");
      setError("");
      setIsValidPassword(false);
    }
  };

  const handleUpload = async (isRetry = false) => {
    // React state updates are asynchronous, so the disabled button alone does
    // not prevent two rapid clicks from starting duplicate uploads.
    if (uploadingRef.current) return;

    if (files.length === 0) {
      setError("업로드할 파일을 선택해주세요.");
      return;
    }

    if (enableE2EE && !encryptionPassword) {
      setError("암호화를 활성화했을 때는 암호화 키를 입력해주세요.");
      return;
    }

    if (enableE2EE && !isValidPassword) {
      setError("비밀번호는 최소 12자 이상이어야 합니다.");
      return;
    }

    uploadingRef.current = true;
    setUploading(true);
    setError("");

    // A filename is not a unique identifier. Keep each file's original index
    // so duplicate names get independent progress and retry state.
    const filesToUpload = getFilesToUpload(files, uploadResults, isRetry);

    if (filesToUpload.length === 0 && isRetry) {
      setError("재시도할 파일이 없습니다. 모든 파일이 이미 업로드되었습니다.");
      uploadingRef.current = false;
      setUploading(false);
      return;
    }

    let hasErrors = false;

    try {
      for (const { file, index: fileIndex } of filesToUpload) {
        const fileKey = getUploadFileKey(fileIndex);

        if (uploadResults[fileKey]?.status === "success") {
          continue;
        }

        try {
          setProgress((prev) => ({
            ...prev,
            [fileKey]: { percent: 0, status: "uploading" },
          }));

          if (isWebGLBuild) {
            setProgress((prev) => ({
              ...prev,
              [fileKey]: { percent: 2, status: "validating" },
            }));
            const validationResult = await validateWebGLBuildFile(file);
            if (!validationResult.isValid) {
              throw new Error(
                validationResult.error || "유효한 WebGL 빌드가 아닙니다."
              );
            }
          }

          let fileToUpload = file;
          let originalMetadata = null;

          if (enableE2EE) {
            setProgress((prev) => ({
              ...prev,
              [fileKey]: { percent: 5, status: "encrypting" },
            }));
            const encryptResult = await encryptFile(file, encryptionPassword);
            if (!encryptResult.success) {
              throw new Error(encryptResult.error);
            }
            fileToUpload = encryptResult.encryptedFile;
            originalMetadata = encryptResult.metadata;
            setProgress((prev) => ({
              ...prev,
              [fileKey]: { percent: 15, status: "uploading" },
            }));
          }

          const uploadResult = await uploadFile({
            filename: fileToUpload.name,
            size: fileToUpload.size,
            mimetype:
              fileToUpload.type == ""
                ? "application/octet-stream"
                : fileToUpload.type,
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
            [fileKey]: {
              percent: enableE2EE ? 25 : 10,
              status: "uploading",
            },
          }));

          const uploadResponse = await new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.upload.addEventListener("progress", (event) => {
              if (event.lengthComputable) {
                const baseProgress = enableE2EE ? 25 : 10;
                const progressPercent =
                  baseProgress +
                  Math.round(
                    (event.loaded / event.total) * (90 - baseProgress)
                  );
                setProgress((prev) => ({
                  ...prev,
                  [fileKey]: {
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
              reject(
                new Error("파일 업로드 중 네트워크 오류가 발생했습니다.")
              );
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
            [fileKey]: { percent: 90, status: "uploading" },
          }));

          const completeResult = await completeFileUpload({ fileId });
          if (completeResult.error) {
            throw new Error(completeResult.error);
          }

          if (!enableE2EE) {
            // AI indexing is a post-upload enhancement. A transient AI
            // failure must not turn an already completed upload into a retry,
            // which would create a duplicate object on the next attempt.
            try {
              const aiResult = await aiUploadComplete(
                fileId,
                file.name,
                file.type || "application/octet-stream"
              );
              if (aiResult?.success) {
                addIndexingFile({
                  fileId: aiResult.fileId,
                  filename: file.name,
                  status: aiResult.status,
                });
              } else if (aiResult?.error) {
                console.warn("AI 인덱싱 요청 실패 (업로드는 완료됨):", aiResult.error);
              }
            } catch (aiError) {
              console.warn("AI 인덱싱 요청 오류 (업로드는 완료됨):", aiError);
            }
          }

          setProgress((prev) => ({
            ...prev,
            [fileKey]: { percent: 100, status: "success" },
          }));
          setUploadResults((prev) => ({
            ...prev,
            [fileKey]: { status: "success", fileId },
          }));
        } catch (fileError) {
          console.error(`파일 ${file.name} 업로드 실패:`, fileError);
          hasErrors = true;
          setProgress((prev) => ({
            ...prev,
            [fileKey]: {
              percent: 0,
              status: "error",
              error: fileError.message,
            },
          }));
          setUploadResults((prev) => ({
            ...prev,
            [fileKey]: { status: "error", error: fileError.message },
          }));
          continue;
        }
      }

      if (!hasErrors) {
        onUploadComplete();
        setFiles([]);
        resetUploadQueueState();
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      } else {
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
      uploadingRef.current = false;
      setUploading(false);
    }
  };

  const handleRetry = () => {
    handleUpload(true);
  };

  const cancelUpload = () => {
    if (uploadingRef.current) return;

    setFiles([]);
    resetUploadQueueState();
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="card-surface p-6">
      <h2 className="mb-4 text-lg font-semibold">파일 업로드</h2>

      {error && (
        <div className="mb-4 rounded-lg border border-error/30 bg-error/10 px-4 py-3 text-sm text-error">
          {error}
        </div>
      )}

      <div
        className={`flex flex-col gap-4 rounded-xl border-2 border-dashed p-6 transition-colors ${
          dragActive
            ? "border-brand-500 bg-brand-500/5"
            : "border-surface-300/40"
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <div className="flex items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            className="file-input file-input-bordered file-input-sm w-full"
            multiple
            onChange={handleFileChange}
            disabled={uploading}
          />
          {files.length > 0 && !uploading && (
            <button
              className="btn-ghost-sm shrink-0"
              onClick={cancelUpload}
              title="선택 취소"
            >
              <FontAwesomeIcon icon={faXmark} />
            </button>
          )}
        </div>

        {files.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <FontAwesomeIcon
              icon={faCloudArrowUp}
              className="text-3xl text-base-content/20"
            />
            <p className="text-sm text-base-content/40">
              파일을 선택하거나 이곳에 드래그하세요
            </p>
          </div>
        )}

        {files.length > 0 && (
          <FileProgressList files={files} progress={progress} />
        )}

        <UploadOptions
          enableE2EE={enableE2EE}
          onE2EEToggle={handleE2EEToggle}
          showPasswordInput={showPasswordInput}
          encryptionPassword={encryptionPassword}
          onPasswordChange={setEncryptionPassword}
          onPasswordValidation={handlePasswordValidation}
          isWebGLBuild={isWebGLBuild}
          onWebGLToggle={setIsWebGLBuild}
          uploading={uploading}
        />

        <div className="flex gap-2">
          <button
            className={`btn-brand ${uploading ? "loading" : ""}`}
            onClick={() => handleUpload(false)}
            disabled={
              uploading ||
              files.length === 0 ||
              (enableE2EE && !isValidPassword)
            }
          >
            {uploading ? "업로드 중..." : "업로드"}
          </button>

          {retryMode && !uploading && (
            <button className="btn-ghost" onClick={handleRetry}>
              <FontAwesomeIcon icon={faArrowsRotate} /> 실패한 파일 재시도
            </button>
          )}

          {retryMode && !uploading && (
            <button className="btn-ghost" onClick={cancelUpload}>
              모두 취소
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
