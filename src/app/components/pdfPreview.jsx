"use client";

import { useEffect, useRef, useState } from "react";
import {
  hasPdfMagic,
  isAllowedPdfPreviewSource,
} from "./pdfPreviewUtils.mjs";

export default function PdfPreview({ url, fileName = "download.pdf" }) {
  const [state, setState] = useState({ status: "loading", objectUrl: "", error: "" });
  const objectUrlRef = useRef("");

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    const revokeObjectUrl = () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = "";
      }
    };

    revokeObjectUrl();
    setState({ status: "loading", objectUrl: "", error: "" });

    if (!isAllowedPdfPreviewSource(url, window.location.href)) {
      setState({
        status: "error",
        objectUrl: "",
        error: "PDF 주소를 확인할 수 없습니다.",
      });
      return () => {
        active = false;
        controller.abort();
        revokeObjectUrl();
      };
    }

    fetch(url, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return response.arrayBuffer();
      })
      .then((buffer) => {
        const bytes = new Uint8Array(buffer);
        if (!hasPdfMagic(bytes)) {
          throw new Error("응답이 PDF 파일이 아닙니다.");
        }

        const objectUrl = URL.createObjectURL(
          new Blob([bytes], { type: "application/pdf" }),
        );

        if (!active) {
          URL.revokeObjectURL(objectUrl);
          return;
        }

        objectUrlRef.current = objectUrl;
        setState({ status: "ready", objectUrl, error: "" });
      })
      .catch((error) => {
        if (!active || error.name === "AbortError") return;
        setState({
          status: "error",
          objectUrl: "",
          error: "PDF 미리보기를 불러오지 못했습니다.",
        });
      });

    return () => {
      active = false;
      controller.abort();
      revokeObjectUrl();
    };
  }, [url]);

  if (state.status === "loading") {
    return (
      <div className="flex min-h-[20vh] items-center justify-center">
        <span className="loading loading-spinner loading-lg" aria-label="PDF 로딩 중" />
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="flex min-h-[20vh] flex-col items-center justify-center gap-3 text-center">
        <p>{state.error}</p>
        {isAllowedPdfPreviewSource(url, window.location.href) && (
          <a
            className="btn btn-primary"
            href={url}
            download={fileName}
            target="_blank"
            rel="noreferrer"
          >
            PDF 다운로드
          </a>
        )}
      </div>
    );
  }

  return (
    <iframe
      src={state.objectUrl}
      className="w-full h-[70vh]"
      title={fileName}
    >
      PDF를 표시할 수 없습니다. 다운로드 버튼을 이용해주세요.
    </iframe>
  );
}
