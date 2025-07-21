"use client";

import { useState, useCallback, useRef, memo } from "react";
import { getSelectedFilesForDownload } from "@/actions/files";
import {
  downloadFilesAsZip,
  formatBytes,
  calculateTotalSize,
} from "@/lib/downloadUtils";
import DecryptionPasswordModal from "./decryptionPasswordModal";
import MultipleDecryptionModal from "./multipleDecryptionModal";

const SelectedDownloadModal = memo(function SelectedDownloadModal({
  isOpen,
  onClose,
  selectedFiles = [],
  onClearSelection,
}) {
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState([]);
  const [error, setError] = useState("");
  const [downloadProgress, setDownloadProgress] = useState(null);
  const [step, setStep] = useState("scan"); // 'scan', 'confirm', 'password', 'downloading', 'complete'
  const [encryptionPasswords, setEncryptionPasswords] = useState({});
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [useMultiplePasswords, setUseMultiplePasswords] = useState(false);

  // 파일 스캔 시작
  const startScan = async () => {
    setLoading(true);
    setError("");
    setStep("scan");

    try {
      if (selectedFiles.length === 0) {
        throw new Error("선택된 파일이 없습니다.");
      }

      const result = await getSelectedFilesForDownload({
        fileIds: selectedFiles,
      });

      if (result.error) {
        throw new Error(result.error);
      }

      if (result.files.length === 0) {
        throw new Error("다운로드할 수 있는 파일이 없습니다.");
      }

      setFiles(result.files);
      console.log("선택 다운로드 - 스캔된 파일들:", result.files);
      console.log(
        "선택 다운로드 - 암호화된 파일 개수:",
        result.files.filter((f) => f.isEncrypted).length
      );
      console.log("setStep(confirm) 호출 직전");
      setStep("confirm");
      console.log("setStep(confirm) 호출 완료");
    } catch (err) {
      console.log("startScan 에러 발생:", err);
      setError(err.message);
      setStep("scan");
    } finally {
      console.log("startScan finally 블록 실행");
      setLoading(false);
    }
  };

  // 다운로드 시작
  const startDownload = async (passwordData = null) => {
    const encryptedFiles = files.filter((file) => file.isEncrypted);

    // 암호화된 파일이 있는 경우 비밀번호 확인
    if (encryptedFiles.length > 0 && !passwordData) {
      setShowPasswordModal(true);
      return;
    }

    setShowPasswordModal(false);
    setEncryptionPasswords(passwordData || {});
    setStep("downloading");
    setDownloadProgress({ completed: 0, total: files.length, percentage: 0 });

    try {
      const zipName = `selected_files_${
        new Date().toISOString().split("T")[0]
      }.zip`;

      const result = await downloadFilesAsZip(
        files,
        zipName,
        (progress) => {
          setDownloadProgress(progress);
        },
        passwordData
      );

      if (result.error) {
        throw new Error(result.error);
      }

      setStep("complete");

      // 선택 해제
      if (onClearSelection) {
        onClearSelection();
      }

      // 성공 메시지 표시 후 자동으로 모달 닫기
      setTimeout(() => {
        handleClose();
      }, 2000);
    } catch (err) {
      setError(err.message);
      setStep("confirm");
      setDownloadProgress(null);
    }
  };

  // 비밀번호 확인 (단일 또는 다중)
  const handlePasswordConfirm = (passwordData) => {
    startDownload(passwordData);
  };

  // 모달 닫기
  const handleClose = () => {
    console.log("handleClose 호출됨 - 스택 추적:", new Error().stack);
    setStep("scan");
    setFiles([]);
    setError("");
    setDownloadProgress(null);
    setEncryptionPasswords({});
    setShowPasswordModal(false);
    setUseMultiplePasswords(false);
    setLoading(false);
    onClose();
  };

  if (!isOpen) return null;

  const totalSize = files.length > 0 ? calculateTotalSize(files) : 0;
  const encryptedFiles = files.filter((file) => file.isEncrypted);

  console.log(
    "SelectedDownloadModal 렌더링 - step:",
    step,
    "files.length:",
    files.length,
    "loading:",
    loading
  );

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-base-100 p-6 rounded-lg shadow-lg max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold">선택 다운로드</h3>
            <button
              onClick={handleClose}
              className="btn btn-ghost btn-sm"
              disabled={step === "downloading"}
            >
              ✕
            </button>
          </div>

          {error && (
            <div className="alert alert-error mb-4">
              <span>{error}</span>
            </div>
          )}

          {/* 스캔 단계 */}
          {step === "scan" && (
            <div className="text-center py-8">
              <div className="mb-4">
                <span className="text-xl">📋</span>
                <h4 className="text-lg font-semibold mt-2">
                  선택된 파일 다운로드
                </h4>
                <p className="text-gray-500 mt-2">
                  선택된 {selectedFiles.length}개 파일을 ZIP으로 다운로드합니다.
                </p>
              </div>

              {loading ? (
                <div className="flex flex-col items-center gap-2">
                  <div className="loading loading-spinner loading-lg"></div>
                  <p>파일 정보를 가져오는 중...</p>
                </div>
              ) : (
                <button
                  onClick={() => {
                    console.log("다운로드 준비 버튼 클릭됨");
                    startScan();
                  }}
                  className="btn btn-primary"
                >
                  다운로드 준비
                </button>
              )}
            </div>
          )}

          {/* 확인 단계 */}
          {step === "confirm" && (
            <div>
              <div className="mb-4">
                <div className="stats shadow w-full">
                  <div className="stat">
                    <div className="stat-title">총 파일 수</div>
                    <div className="stat-value text-primary">
                      {files.length}
                    </div>
                  </div>
                  <div className="stat">
                    <div className="stat-title">총 크기</div>
                    <div className="stat-value text-secondary">
                      {formatBytes(totalSize)}
                    </div>
                  </div>
                  {encryptedFiles.length > 0 && (
                    <div className="stat">
                      <div className="stat-title">암호화 파일</div>
                      <div className="stat-value text-warning">
                        {encryptedFiles.length}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {encryptedFiles.length > 0 && (
                <div className="alert alert-warning mb-4">
                  <div className="flex items-center gap-2">
                    <span>🔐</span>
                    <div className="flex-1">
                      <div className="font-semibold">암호화된 파일 포함</div>
                      <div className="text-sm mb-3">
                        {encryptedFiles.length}개의 암호화된 파일이 포함되어
                        있습니다. 다운로드 시 복호화 비밀번호가 필요합니다.
                      </div>

                      {/* 비밀번호 입력 방식 선택 */}
                      <div className="form-control">
                        <label className="label cursor-pointer justify-start gap-2">
                          <input
                            type="radio"
                            name="passwordMethod"
                            className="radio radio-sm"
                            checked={!useMultiplePasswords}
                            onChange={() => setUseMultiplePasswords(false)}
                          />
                          <span className="text-sm">
                            모든 파일에 동일한 비밀번호 사용
                          </span>
                        </label>
                      </div>
                      <div className="form-control">
                        <label className="label cursor-pointer justify-start gap-2">
                          <input
                            type="radio"
                            name="passwordMethod"
                            className="radio radio-sm"
                            checked={useMultiplePasswords}
                            onChange={() => setUseMultiplePasswords(true)}
                          />
                          <span className="text-sm">
                            파일별로 다른 비밀번호 입력
                          </span>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="mb-4">
                <h5 className="font-semibold mb-2">다운로드될 파일들:</h5>
                <div className="max-h-40 overflow-y-auto border rounded p-2">
                  {files.slice(0, 10).map((file, index) => (
                    <div
                      key={index}
                      className="text-sm py-1 flex justify-between items-center"
                    >
                      <div className="flex items-center gap-2 flex-1">
                        {file.isEncrypted && (
                          <span className="text-warning">🔐</span>
                        )}
                        <span className="truncate">{file.originalName}</span>
                      </div>
                      <span className="text-gray-500 ml-2">
                        {formatBytes(file.size)}
                      </span>
                    </div>
                  ))}
                  {files.length > 10 && (
                    <div className="text-sm text-gray-500 pt-2 border-t">
                      ... 그 외 {files.length - 10}개 파일
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-2 justify-end">
                <button onClick={handleClose} className="btn btn-ghost">
                  취소
                </button>
                <button
                  onClick={() => startDownload()}
                  className="btn btn-primary"
                >
                  다운로드 시작
                </button>
              </div>
            </div>
          )}

          {/* 다운로드 진행 단계 */}
          {step === "downloading" && downloadProgress && (
            <div className="text-center py-8">
              <div className="mb-4">
                <div className="loading loading-spinner loading-lg"></div>
              </div>

              <h4 className="text-lg font-semibold mb-2">다운로드 중...</h4>

              <div className="mb-4">
                <div className="text-sm text-gray-500 mb-2">
                  {downloadProgress.currentFile}
                  {downloadProgress.encryptedCount > 0 &&
                    ` (암호화 파일 ${downloadProgress.encryptedCount}개 복호화 중)`}
                </div>
                <progress
                  className="progress progress-primary w-full"
                  value={downloadProgress.percentage}
                  max="100"
                ></progress>
                <div className="text-sm mt-1">
                  {downloadProgress.completed} / {downloadProgress.total} 파일 (
                  {downloadProgress.percentage}%)
                </div>
              </div>

              <p className="text-gray-500 text-sm">
                브라우저에서 파일을 다운로드하고 압축하는 중입니다.
                <br />
                {encryptedFiles.length > 0 &&
                  "암호화된 파일을 복호화하고 있습니다."}
              </p>
            </div>
          )}

          {/* 완료 단계 */}
          {step === "complete" && (
            <div className="text-center py-8">
              <div className="mb-4">
                <span className="text-4xl">✅</span>
              </div>
              <h4 className="text-lg font-semibold mb-2">다운로드 완료!</h4>
              <p className="text-gray-500">
                선택된 파일들이 성공적으로 다운로드되었습니다.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 복호화 비밀번호 모달 */}
      {!useMultiplePasswords ? (
        <DecryptionPasswordModal
          isOpen={showPasswordModal}
          onClose={() => setShowPasswordModal(false)}
          onConfirm={(password) => {
            // 모든 암호화 파일에 동일한 비밀번호 적용
            const passwordMap = {};
            encryptedFiles.forEach((file) => {
              passwordMap[file.id] = password;
            });
            handlePasswordConfirm(passwordMap);
          }}
          encryptedFileCount={encryptedFiles.length}
          title="선택 파일 다운로드 - 복호화"
        />
      ) : (
        <MultipleDecryptionModal
          isOpen={showPasswordModal}
          onClose={() => setShowPasswordModal(false)}
          onConfirm={handlePasswordConfirm}
          encryptedFiles={encryptedFiles}
          title="선택 파일 다운로드 - 파일별 복호화"
        />
      )}
    </>
  );
});

export default SelectedDownloadModal;
