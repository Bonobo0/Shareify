"use client";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faXmark } from "@fortawesome/free-solid-svg-icons";
import PdfPreview from "./pdfPreview";

export default function PreviewModal({
  isOpen,
  onClose,
  file,
  url,
  mimeType,
  isDecrypted,
}) {
  if (!isOpen) return null;

  const type = mimeType?.split("/")[0]; // image, video, audio 등
  const isPdf = mimeType?.toLowerCase().startsWith("application/pdf");

  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = url;
    link.download = file.name;
    link.click();
  };

  const handleClose = () => {
    // 복호화된 URL인 경우 메모리 해제
    if (isDecrypted && url.startsWith("blob:")) {
      URL.revokeObjectURL(url);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 p-4">
      <div className="bg-base-100 rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">{file.name}</h2>
          <button className="btn btn-ghost btn-sm" onClick={handleClose}>
            <FontAwesomeIcon icon={faXmark} />
          </button>
        </div>

        <div className="flex justify-center">
          {type === "image" && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={url}
              alt={file.name}
              className="max-w-full max-h-[70vh] object-contain"
            />
          )}
          {type === "video" && (
            <video src={url} controls className="max-w-full max-h-[70vh]">
              브라우저가 비디오를 지원하지 않습니다.
            </video>
          )}
          {type === "audio" && (
            <div className="w-full">
              <audio src={url} controls className="w-full">
                브라우저가 오디오를 지원하지 않습니다.
              </audio>
            </div>
          )}
          {isPdf && (
            <PdfPreview url={url} fileName={file.name} />
          )}
          {type === "application" && !isPdf && (
            <iframe
              src={url}
              className="w-full h-[70vh]"
              title={file.name}
              sandbox=""
            >
              파일을 표시할 수 없습니다.
            </iframe>
          )}
          {type === "text" && (
            <iframe
              src={url}
              className="w-full h-[70vh]"
              title={file.name}
              sandbox=""
            >
              텍스트를 표시할 수 없습니다.
            </iframe>
          )}
        </div>

        <div className="mt-4 text-center">
          <button className="btn btn-primary" onClick={handleDownload}>
            파일 다운로드
          </button>
        </div>
      </div>
    </div>
  );
}
