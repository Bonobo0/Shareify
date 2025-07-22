"use client";

import { useState } from "react";
import { getAllFilesForDownload } from "@/actions/files";
import {
  downloadFilesAsZip,
  formatBytes,
  calculateTotalSize,
} from "@/lib/downloadUtils";
import DecryptionPasswordModal from "./decryptionPasswordModal";
import MultipleDecryptionModal from "./multipleDecryptionModal";

export default function BulkDownloadModal({
  isOpen,
  onClose,
  directoryId,
  directoryName = "폴더",
  getFilesAction, // 커스텀 파일 조회 액션 (공유 파일용)
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
      // 커스텀 액션이 있으면 사용, 없으면 기본 액션 사용
      const result = getFilesAction
        ? await getFilesAction(directoryId)
        : await getAllFilesForDownload({ directoryId });

      if (result.error) {
        throw new Error(result.error);
      }

      if (result.files.length === 0) {
        throw new Error("다운로드할 파일이 없습니다.");
      }

      setFiles(result.files);
      console.log("스캔된 파일들:", result.files);
      console.log(
        "암호화된 파일 개수:",
        result.files.filter((f) => f.isEncrypted).length
      );
      setStep("confirm");
    } catch (err) {
      setError(err.message);
      setStep("scan");
    } finally {
      setLoading(false);
    }
  };

  // 다운로드 시작
  const startDownload = async (passwordData = null) => {
    console.log("=== startDownload 함수 호출 ===");
    console.log("전체 파일 목록:", files);

    // 파일별로 isEncrypted 값 확인
    files.forEach((file, index) => {
      console.log(
        `파일 ${index}: ${file.path || file.originalName}, isEncrypted:`,
        file.isEncrypted,
        typeof file.isEncrypted
      );
    });

    const encryptedFiles = files.filter((file) => file.isEncrypted);
    console.log("필터링된 암호화 파일들:", encryptedFiles);
    console.log("암호화 파일 개수:", encryptedFiles.length);
    console.log("전달받은 비밀번호 데이터:", passwordData);
    console.log("showPasswordModal 현재 상태:", showPasswordModal);

    // 암호화된 파일이 있는데 비밀번호가 없는 경우
    if (encryptedFiles.length > 0 && !passwordData) {
      console.log("비밀번호 모달 표시 조건 만족 - 모달 열기");
      console.log("암호화 파일 개수:", encryptedFiles.length);
      setShowPasswordModal(true);
      return;
    }

    console.log("다운로드 진행 - 비밀번호 데이터:", passwordData);

    setShowPasswordModal(false);
    setEncryptionPasswords(passwordData || {});
    setStep("downloading");
    setDownloadProgress({ completed: 0, total: files.length, percentage: 0 });

    try {
      const zipName = `${directoryName}_${
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

  console.log("렌더링 시 암호화 파일 개수:", encryptedFiles.length);
  console.log("showPasswordModal 상태:", showPasswordModal);
  console.log("useMultiplePasswords 상태:", useMultiplePasswords);

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-base-100 p-6 rounded-lg shadow-lg max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold">전체 다운로드</h3>
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
                <span className="text-xl">📁</span>
                <h4 className="text-lg font-semibold mt-2">{directoryName}</h4>
                <p className="text-gray-500 mt-2">
                  이 폴더의 모든 파일을 ZIP으로 다운로드합니다.
                </p>
              </div>

              {loading ? (
                <div className="flex flex-col items-center gap-2">
                  <div className="loading loading-spinner loading-lg"></div>
                  <p>파일을 스캔하는 중...</p>
                </div>
              ) : (
                <button onClick={startScan} className="btn btn-primary">
                  파일 스캔 시작
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
                        <span className="truncate">{file.path}</span>
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
                  onClick={() => {
                    console.log("다운로드 시작 버튼 클릭됨");
                    console.log(
                      "현재 암호화 파일 개수:",
                      encryptedFiles.length
                    );
                    console.log(
                      "현재 showPasswordModal 상태:",
                      showPasswordModal
                    );
                    startDownload();
                  }}
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
                <br />
                잠시만 기다려 주세요.
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
                ZIP 파일이 성공적으로 다운로드되었습니다.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 복호화 비밀번호 모달 */}
      {console.log("모달 렌더링 조건:", {
        useMultiplePasswords,
        showPasswordModal,
        encryptedFilesLength: encryptedFiles.length,
      })}

      {!useMultiplePasswords ? (
        <DecryptionPasswordModal
          isOpen={showPasswordModal}
          onClose={() => {
            console.log("단일 비밀번호 모달 닫기");
            setShowPasswordModal(false);
          }}
          onConfirm={(password) => {
            console.log("단일 비밀번호 확인됨:", password);
            // 모든 암호화 파일에 동일한 비밀번호 적용
            const passwordMap = {};
            encryptedFiles.forEach((file) => {
              passwordMap[file.id] = password;
            });
            handlePasswordConfirm(passwordMap);
          }}
          encryptedFileCount={encryptedFiles.length}
          title="전체 다운로드 - 복호화"
        />
      ) : (
        <MultipleDecryptionModal
          isOpen={showPasswordModal}
          onClose={() => {
            console.log("다중 비밀번호 모달 닫기");
            setShowPasswordModal(false);
          }}
          onConfirm={(passwordData) => {
            console.log("다중 비밀번호 확인됨:", passwordData);
            handlePasswordConfirm(passwordData);
          }}
          encryptedFiles={encryptedFiles}
          title="전체 다운로드 - 파일별 복호화"
        />
      )}
    </>
  );
}
