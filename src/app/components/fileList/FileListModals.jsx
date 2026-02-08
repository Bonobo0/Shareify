"use client";

import React from "react";
import dynamic from "next/dynamic";

// LiveEditor uses @editorjs/* packages that reference browser-only 'Element' API
// at module evaluation time, so it must be dynamically imported with ssr: false
const LiveEditor = dynamic(() => import("../liveEditor"), { ssr: false });

export default function FileListModals({
  decryptModal,
  decryptPassword,
  setDecryptPassword,
  setDecryptModal,
  actionLoading,
  onEncryptedDownload,
  onEncryptedPreview,
  previewModal,
  setPreviewModal,
  shareModal,
  setShareModal,
  files,
  updateSingleFile,
  fetchData,
  alertModal,
  setAlertModal,
  confirmModal,
  setConfirmModal,
  directoryShareModal,
  setDirectoryShareModal,
  updateSingleDirectory,
  editDirectoryModal,
  setEditDirectoryModal,
  setDirectories,
  bulkDownloadModal,
  setBulkDownloadModal,
  bulkHandler,
  selectedItems,
  ShareModal: ShareModalComponent,
  DirectoryShareModal: DirectoryShareModalComponent,
  EditDirectoryModal: EditDirectoryModalComponent,
  BulkDownloadModal: BulkDownloadModalComponent,
  SelectedDownloadModal: SelectedDownloadModalComponent,
}) {
  return (
    <>
      {/* 암호화 파일 복호화 모달 */}
      {decryptModal && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg">
              {decryptModal.action === "download"
                ? "파일 다운로드"
                : "미리보기"}
            </h3>
            <p className="py-4">
              이 파일은 암호화되어 있습니다. 복호화 키를 입력해주세요.
            </p>
            <p className="text-sm text-gray-500 mb-4">
              파일: {decryptModal.originalName}
            </p>

            <div className="form-control">
              <label className="label">
                <span className="label-text">복호화 키</span>
              </label>
              <input
                type="password"
                className="input input-bordered"
                placeholder="암호화 시 사용한 비밀번호를 입력하세요"
                value={decryptPassword}
                onChange={(e) => setDecryptPassword(e.target.value)}
              />
            </div>

            <div className="modal-action">
              <button
                className="btn"
                onClick={() => {
                  setDecryptModal(null);
                  setDecryptPassword("");
                }}
              >
                취소
              </button>
              <button
                className={`btn btn-primary ${
                  actionLoading[decryptModal.id] ? "loading" : ""
                }`}
                onClick={
                  decryptModal.action === "download"
                    ? onEncryptedDownload
                    : onEncryptedPreview
                }
                disabled={actionLoading[decryptModal.id]}
              >
                {decryptModal.action === "download" ? "다운로드" : "미리보기"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 미리보기 모달 */}
      {previewModal && (
        <div className="modal modal-open">
          <div className="modal-box max-w-4xl">
            <h3 className="font-bold text-lg">
              {previewModal.file.originalName}
            </h3>
            <div className="py-4">
              {previewModal.file.mimetype?.startsWith("image/") ||
              previewModal.file.originalMimetype?.startsWith("image/") ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewModal.url}
                  alt={previewModal.file.originalName}
                  className="max-w-full h-auto"
                />
              ) : previewModal.file.mimetype?.startsWith("video/") ||
                previewModal.file.originalMimetype?.startsWith("video/") ? (
                <video
                  src={previewModal.url}
                  controls
                  className="max-w-full h-auto"
                />
              ) : previewModal.file.mimetype?.startsWith("audio/") ||
                previewModal.file.originalMimetype?.startsWith("audio/") ? (
                <audio src={previewModal.url} controls className="w-full" />
              ) : previewModal.file.mimetype?.startsWith("application/pdf") ||
                previewModal.file.originalMimetype?.startsWith(
                  "application/pdf"
                ) ? (
                <iframe
                  src={previewModal.url}
                  className="w-full h-[70vh]"
                  title={previewModal.file.originalName}
                >
                  PDF를 표시할 수 없습니다.
                </iframe>
              ) : previewModal.file.mimetype?.startsWith("text/") ||
                previewModal.file.originalMimetype?.startsWith("text/") ? (
                <iframe
                  src={previewModal.url}
                  className="w-full h-[70vh]"
                  title={previewModal.file.originalName}
                >
                  텍스트를 표시할 수 없습니다.
                </iframe>
              ) : previewModal.file.originalName.endsWith(".ejtxt") ? ( 
                <LiveEditor
                  file={previewModal.file}
                  fileUrl={previewModal.url}
                  encryptionPassword={previewModal.encryptionPassword || null}
                  onClose={() => {
                    if (previewModal.url.startsWith("blob:")) {
                      URL.revokeObjectURL(previewModal.url);
                    }
                    setPreviewModal(null);
                  }}
                  onSaved={() => fetchData()}
                />
              ) :
               (
                <p>미리보기를 지원하지 않는 파일 형식입니다.</p>
              )}
            </div>
            <div className="modal-action">
              <button
                className="btn"
                onClick={() => {
                  if (previewModal.url.startsWith("blob:")) {
                    URL.revokeObjectURL(previewModal.url);
                  }
                  setPreviewModal(null);
                }}
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 공유 모달 */}
      <ShareModalComponent
        file={
          shareModal.fileId
            ? files.find((f) => f.id === shareModal.fileId)
            : null
        }
        isOpen={shareModal.isOpen}
        onClose={() => setShareModal({ isOpen: false, fileId: null })}
        onUpdate={() =>
          shareModal.fileId ? updateSingleFile(shareModal.fileId) : fetchData()
        }
      />

      {/* Alert Modal */}
      {alertModal.show && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg">알림</h3>
            <p className="py-4">{alertModal.message}</p>
            <div className="modal-action">
              <button
                className="btn btn-primary"
                onClick={() => setAlertModal({ show: false, message: "" })}
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Modal */}
      {confirmModal.show && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg">확인</h3>
            <p className="py-4">{confirmModal.message}</p>
            <div className="modal-action">
              <button
                className="btn btn-outline"
                onClick={() =>
                  setConfirmModal({ show: false, message: "", callback: null })
                }
              >
                취소
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  if (confirmModal.callback) {
                    confirmModal.callback();
                  }
                  setConfirmModal({ show: false, message: "", callback: null });
                }}
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 디렉토리 공유 모달 */}
      <DirectoryShareModalComponent
        isOpen={directoryShareModal.isOpen}
        onClose={() =>
          setDirectoryShareModal({
            isOpen: false,
            directoryId: null,
            directoryName: "",
          })
        }
        directoryId={directoryShareModal.directoryId}
        directoryName={directoryShareModal.directoryName}
        onUpdate={() =>
          directoryShareModal.directoryId
            ? updateSingleDirectory(directoryShareModal.directoryId)
            : fetchData()
        }
      />

      {/* 디렉토리 수정 모달 */}
      <EditDirectoryModalComponent
        isOpen={editDirectoryModal.isOpen}
        onClose={() =>
          setEditDirectoryModal({
            isOpen: false,
            directoryId: null,
            directoryName: "",
            directoryDescription: "",
          })
        }
        directoryId={editDirectoryModal.directoryId}
        directoryName={editDirectoryModal.directoryName}
        directoryDescription={editDirectoryModal.directoryDescription}
        onUpdate={(updatedDirectory) => {
          if (updatedDirectory && editDirectoryModal.directoryId) {
            setDirectories((prevDirs) =>
              prevDirs.map((dir) =>
                dir.id === editDirectoryModal.directoryId
                  ? { ...dir, ...updatedDirectory }
                  : dir
              )
            );
          } else {
            fetchData();
          }
        }}
      />

      {/* 전체 다운로드 모달 */}
      <BulkDownloadModalComponent
        isOpen={bulkDownloadModal.isOpen}
        onClose={() =>
          setBulkDownloadModal({
            isOpen: false,
            directoryId: null,
            directoryName: "",
          })
        }
        directoryId={bulkDownloadModal.directoryId}
        directoryName={bulkDownloadModal.directoryName}
      />

      {/* 삭제 진행 상황 모달 */}
      {React.createElement(bulkHandler.DeleteProgressModal)}

      {/* 선택 다운로드 모달 */}
      <SelectedDownloadModalComponent
        isOpen={bulkHandler.showDownloadModal}
        onClose={() => bulkHandler.setShowDownloadModal(false)}
        selectedFiles={Array.from(selectedItems)
          .filter((item) => item.startsWith("file-"))
          .map((item) => item.replace("file-", ""))}
        onClearSelection={() => {
          bulkHandler.clearSelection();
          bulkHandler.setSelectMode && bulkHandler.setSelectMode(false);
        }}
      />
    </>
  );
}
