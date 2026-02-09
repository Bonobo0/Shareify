"use client";

import React, { useCallback, useRef, useState, useEffect } from "react";
import { createReactEditorJS } from "react-editor-js";
import { prepareFileUpdate, completeFileUpdate } from "@/actions/files";
import { encryptFile } from "@/lib/crypto/encryption";

// Editor.js 플러그인
import Header from "@editorjs/header";
import List from "@editorjs/list";
import Checklist from "@editorjs/checklist";
import Quote from "@editorjs/quote";
import CodeTool from "@editorjs/code";
import Delimiter from "@editorjs/delimiter";
import InlineCode from "@editorjs/inline-code";
import Marker from "@editorjs/marker";
import Table from "@editorjs/table";

const ReactEditorJS = createReactEditorJS();

const EDITOR_JS_TOOLS = {
  header: {
    class: Header,
    config: {
      levels: [1, 2, 3, 4, 5, 6],
      defaultLevel: 2,
    },
  },
  list: {
    class: List,
    inlineToolbar: true,
  },
  checklist: {
    class: Checklist,
    inlineToolbar: true,
  },
  quote: {
    class: Quote,
    inlineToolbar: true,
  },
  code: CodeTool,
  delimiter: Delimiter,
  inlineCode: {
    class: InlineCode,
  },
  marker: {
    class: Marker,
  },
  table: {
    class: Table,
    inlineToolbar: true,
    config: {
      rows: 2,
      cols: 3,
    },
  },
};

// HTML 내보내기용 CSS 스타일
function getExportStyles() {
  return `
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 20px; color: #333; }
      h1, h2, h3, h4, h5, h6 { margin-top: 1.5em; margin-bottom: 0.5em; font-weight: 600; }
      p { margin: 0.8em 0; }
      table { border-collapse: collapse; width: 100%; margin: 1em 0; }
      th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
      th { background-color: #f5f5f5; font-weight: 600; }
      tr:nth-child(even) { background-color: #fafafa; }
      blockquote { border-left: 4px solid #ddd; margin: 1em 0; padding: 0.5em 1em; color: #666; background: #f9f9f9; }
      blockquote cite { display: block; margin-top: 0.5em; font-style: italic; color: #999; }
      pre { background: #f4f4f4; border: 1px solid #ddd; border-radius: 4px; padding: 12px; overflow-x: auto; }
      code { font-family: 'SFMono-Regular', Consolas, monospace; font-size: 0.9em; }
      pre code { background: none; padding: 0; }
      :not(pre) > code { background: #f0f0f0; padding: 2px 6px; border-radius: 3px; }
      hr { border: none; border-top: 2px solid #eee; margin: 2em 0; }
      ul, ol { padding-left: 1.5em; margin: 0.8em 0; }
      li { margin: 0.3em 0; }
      .checklist-item { display: flex; align-items: center; gap: 8px; margin: 4px 0; }
      .checklist-item input[type="checkbox"] { width: 16px; height: 16px; }
    </style>
  `;
}

// 에디터 블록 → HTML 변환
function blocksToHtml(blocks) {
  return blocks
    .map((block) => {
      switch (block.type) {
        case "header":
          return `<h${block.data.level}>${block.data.text}</h${block.data.level}>`;
        case "paragraph":
          return `<p>${block.data.text}</p>`;
        case "list": {
          const tag = block.data.style === "ordered" ? "ol" : "ul";
          const items = block.data.items
            .map(
              (item) =>
                `<li>${typeof item === "string" ? item : item.content || item.text || ""}</li>`,
            )
            .join("");
          return `<${tag}>${items}</${tag}>`;
        }
        case "checklist":
          return `<div class="checklist">${block.data.items
            .map(
              (item) =>
                `<div class="checklist-item"><input type="checkbox" ${item.checked ? "checked" : ""} disabled /><span>${item.text}</span></div>`,
            )
            .join("")}</div>`;
        case "quote":
          return `<blockquote><p>${block.data.text}</p>${block.data.caption ? `<cite>— ${block.data.caption}</cite>` : ""}</blockquote>`;
        case "code":
          return `<pre><code>${block.data.code}</code></pre>`;
        case "delimiter":
          return "<hr />";
        case "table": {
          if (!block.data.content || block.data.content.length === 0) return "";
          const withHeadings = block.data.withHeadings !== false;
          let html = "<table>";
          if (withHeadings && block.data.content.length > 0) {
            html += `<thead><tr>${block.data.content[0].map((cell) => `<th>${cell}</th>`).join("")}</tr></thead>`;
            html += "<tbody>";
            for (let i = 1; i < block.data.content.length; i++) {
              html += `<tr>${block.data.content[i].map((cell) => `<td>${cell}</td>`).join("")}</tr>`;
            }
            html += "</tbody>";
          } else {
            html += "<tbody>";
            html += block.data.content
              .map(
                (row) =>
                  `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`,
              )
              .join("");
            html += "</tbody>";
          }
          html += "</table>";
          return html;
        }
        default:
          return `<p>${JSON.stringify(block.data)}</p>`;
      }
    })
    .join("\n");
}

// 에디터 블록 → Markdown 변환
function blocksToMarkdown(blocks) {
  return blocks
    .map((block) => {
      switch (block.type) {
        case "header":
          return `${"#".repeat(block.data.level)} ${stripHtml(block.data.text)}`;
        case "paragraph":
          return stripHtml(block.data.text);
        case "list":
          return block.data.items
            .map((item, i) => {
              const text =
                typeof item === "string"
                  ? item
                  : item.content || item.text || "";
              return block.data.style === "ordered"
                ? `${i + 1}. ${stripHtml(text)}`
                : `- ${stripHtml(text)}`;
            })
            .join("\n");
        case "checklist":
          return block.data.items
            .map(
              (item) =>
                `- [${item.checked ? "x" : " "}] ${stripHtml(item.text)}`,
            )
            .join("\n");
        case "quote":
          return `> ${stripHtml(block.data.text)}${block.data.caption ? `\n> — ${stripHtml(block.data.caption)}` : ""}`;
        case "code":
          return `\`\`\`\n${block.data.code}\n\`\`\``;
        case "delimiter":
          return "---";
        case "table": {
          if (!block.data.content || block.data.content.length === 0) return "";
          const headerRow = block.data.content[0]
            .map((cell) => stripHtml(cell))
            .join(" | ");
          const separator = block.data.content[0].map(() => "---").join(" | ");
          const bodyRows = block.data.content
            .slice(1)
            .map((row) => row.map((cell) => stripHtml(cell)).join(" | "))
            .join("\n");
          return `${headerRow}\n${separator}${bodyRows ? "\n" + bodyRows : ""}`;
        }
        default:
          return JSON.stringify(block.data);
      }
    })
    .join("\n\n");
}

// 에디터 블록 → 일반 텍스트 변환
function blocksToText(blocks) {
  return blocks
    .map((block) => {
      switch (block.type) {
        case "header":
        case "paragraph":
          return stripHtml(block.data.text);
        case "list":
          return block.data.items
            .map((item) => {
              const text =
                typeof item === "string"
                  ? item
                  : item.content || item.text || "";
              return `• ${stripHtml(text)}`;
            })
            .join("\n");
        case "checklist":
          return block.data.items
            .map(
              (item) => `${item.checked ? "☑" : "☐"} ${stripHtml(item.text)}`,
            )
            .join("\n");
        case "quote":
          return `"${stripHtml(block.data.text)}"${block.data.caption ? ` — ${stripHtml(block.data.caption)}` : ""}`;
        case "code":
          return block.data.code;
        case "delimiter":
          return "———";
        case "table":
          return block.data.content
            .map((row) => row.map((cell) => stripHtml(cell)).join("\t"))
            .join("\n");
        default:
          return "";
      }
    })
    .filter(Boolean)
    .join("\n\n");
}

// HTML 태그 제거 유틸
function stripHtml(html) {
  if (!html) return "";
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"');
}

/**
 * LiveEditor 컴포넌트
 *
 * @param {Object} file - 파일 메타데이터 (id, originalName, isEncrypted, ...)
 * @param {string} fileUrl - 파일 내용 URL (blob: URL 또는 일반 URL)
 * @param {string} encryptionPassword - 암호화된 파일의 비밀번호 (옵션)
 * @param {Function} onClose - 에디터 닫기 콜백
 * @param {Function} onSaved - 저장 완료 콜백 (옵션)
 */
export default function LiveEditor({
  file,
  fileUrl,
  encryptionPassword = null,
  onClose,
  onSaved,
}) {
  const editorCore = useRef(null);
  const autoSaveTimer = useRef(null);
  const [saveStatus, setSaveStatus] = useState("loaded"); // loaded, unsaved, saving, saved, error
  const [saveMessage, setSaveMessage] = useState("");
  const [editorData, setEditorData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [exportDropdown, setExportDropdown] = useState(false);

  // 에디터 인스턴스 참조 저장
  const handleInitialize = useCallback((instance) => {
    editorCore.current = instance;
  }, []);

  // 파일 URL에서 에디터 데이터 로드
  useEffect(() => {
    if (!fileUrl) return;

    const loadContent = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const response = await fetch(fileUrl);
        if (!response.ok) throw new Error("파일 로드 실패");

        const text = await response.text();
        let parsed;
        try {
          parsed = JSON.parse(text);
        } catch {
          // JSON이 아닌 경우 빈 paragraph 블록으로 래핑
          parsed = {
            time: Date.now(),
            blocks: [{ type: "paragraph", data: { text: text } }],
          };
        }

        // Editor.js 형식 검증
        if (!parsed.blocks || !Array.isArray(parsed.blocks)) {
          parsed = {
            time: parsed.time || Date.now(),
            blocks: [
              {
                type: "paragraph",
                data: { text: JSON.stringify(parsed, null, 2) },
              },
            ],
          };
        }

        setEditorData(parsed);
      } catch (err) {
        console.error("에디터 데이터 로드 오류:", err);
        setLoadError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadContent();
  }, [fileUrl]);

  // 에디터 데이터 가져오기
  const getEditorData = useCallback(async () => {
    if (!editorCore.current) return null;
    try {
      return await editorCore.current.save();
    } catch (err) {
      console.error("에디터 데이터 추출 오류:", err);
      return null;
    }
  }, []);

  // 저장 함수
  const handleSave = useCallback(async () => {
    if (!file?.id) return;
    if (saveStatus === "saving") return;

    setSaveStatus("saving");
    setSaveMessage("저장 중...");

    try {
      // 에디터 데이터 직렬화
      const data = await getEditorData();
      if (!data) throw new Error("에디터 데이터를 가져올 수 없습니다.");

      const jsonString = JSON.stringify(data);
      const jsonBlob = new Blob([jsonString], { type: "application/json" });

      // presigned URL 요청
      const prepareResult = await prepareFileUpdate({ fileId: file.id });
      if (prepareResult.error) throw new Error(prepareResult.error);

      let uploadBody;
      let uploadSize;
      let originalSize;
      let contentType;

      if (file.isEncrypted && encryptionPassword) {
        // 암호화된 파일: 재암호화 후 업로드
        const fileObj = new File([jsonBlob], file.originalName, {
          type: "application/json",
        });

        const encryptResult = await encryptFile(fileObj, encryptionPassword);
        if (!encryptResult.success) {
          throw new Error(encryptResult.error || "파일 암호화 실패");
        }

        uploadBody = encryptResult.encryptedFile;
        uploadSize = encryptResult.encryptedFile.size;
        originalSize = jsonBlob.size;
        contentType = "application/octet-stream";
      } else {
        // 일반 파일: JSON 직접 업로드
        uploadBody = jsonBlob;
        uploadSize = jsonBlob.size;
        originalSize = undefined;
        contentType = "application/json";
      }

      // presigned URL로 파일 업로드
      const uploadResponse = await fetch(prepareResult.uploadUrl, {
        method: "PUT",
        body: uploadBody,
        headers: {
          "Content-Type": contentType,
        },
      });

      if (!uploadResponse.ok) {
        throw new Error(`업로드 실패 (${uploadResponse.status})`);
      }

      // DB 메타데이터 업데이트
      const completeResult = await completeFileUpdate({
        fileId: file.id,
        newSize: uploadSize,
        originalSize,
      });

      if (completeResult.error) throw new Error(completeResult.error);

      setSaveStatus("saved");
      setSaveMessage("저장 완료");

      if (onSaved) onSaved();

      // 3초 후 상태 리셋
      setTimeout(() => {
        setSaveStatus((prev) => (prev === "saved" ? "loaded" : prev));
        setSaveMessage("");
      }, 3000);
    } catch (err) {
      console.error("파일 저장 오류:", err);
      setSaveStatus("error");
      setSaveMessage(err.message || "저장 실패");
    }
  }, [file, encryptionPassword, getEditorData, saveStatus, onSaved]);

  // 에디터 내용 변경 시 자동 저장 (30초 디바운스)
  const handleChange = useCallback(async () => {
    setSaveStatus("unsaved");
    setSaveMessage("");

    if (autoSaveTimer.current) {
      clearTimeout(autoSaveTimer.current);
    }

    autoSaveTimer.current = setTimeout(() => {
      handleSave();
    }, 30000);
  }, [handleSave]);

  // Ctrl+S 키보드 단축키
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [handleSave]);

  // 내보내기: 파일로 다운로드
  const handleExport = useCallback(
    async (format) => {
      setExportDropdown(false);
      const data = await getEditorData();
      if (!data || !data.blocks) return;

      let content, mimeType, extension;

      switch (format) {
        case "html": {
          const htmlBody = blocksToHtml(data.blocks);
          const styles = getExportStyles();
          content = `<!DOCTYPE html>\n<html>\n<head><meta charset="utf-8"><title>${file?.originalName || "document"}</title>${styles}</head>\n<body>\n${htmlBody}\n</body>\n</html>`;
          mimeType = "text/html";
          extension = "html";
          break;
        }
        case "markdown": {
          content = blocksToMarkdown(data.blocks);
          mimeType = "text/markdown";
          extension = "md";
          break;
        }
        case "text": {
          content = blocksToText(data.blocks);
          mimeType = "text/plain";
          extension = "txt";
          break;
        }
        case "json": {
          content = JSON.stringify(data, null, 2);
          mimeType = "application/json";
          extension = "json";
          break;
        }
        default:
          return;
      }

      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const baseName =
        file?.originalName?.replace(/\.ejtxt$/, "") || "document";
      a.download = `${baseName}.${extension}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
    [getEditorData, file],
  );

  // 저장 상태 뱃지 색상
  const statusBadge = () => {
    switch (saveStatus) {
      case "saving":
        return (
          <span className="badge badge-warning gap-1 text-xs">
            <span className="loading loading-spinner loading-xs"></span>
            저장 중...
          </span>
        );
      case "saved":
        return (
          <span className="badge badge-success gap-1 text-xs">✓ 저장됨</span>
        );
      case "unsaved":
        return <span className="badge badge-info gap-1 text-xs">● 수정됨</span>;
      case "error":
        return (
          <span className="badge badge-error gap-1 text-xs" title={saveMessage}>
            ✕ 오류
          </span>
        );
      default:
        return null;
    }
  };

  // 로딩 상태
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <span className="loading loading-spinner loading-lg"></span>
        <p className="text-sm opacity-60">에디터 로딩 중...</p>
      </div>
    );
  }

  // 로드 오류
  if (loadError) {
    return (
      <div className="alert alert-error">
        <span>에디터 데이터 로드 실패: {loadError}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full">
      {/* 툴바 */}
      <div className="flex items-center justify-between gap-2 px-2 py-2 border-b border-base-300 bg-base-200 rounded-t-lg">
        <div className="flex items-center gap-2">
          {file?.isEncrypted && (
            <span className="badge badge-warning badge-xs">🔒 암호화</span>
          )}
          {statusBadge()}
        </div>

        <div className="flex items-center gap-1">
          {/* 저장 버튼 */}
          <button
            className="btn btn-sm btn-primary"
            onClick={handleSave}
            disabled={saveStatus === "saving" || saveStatus === "loaded"}
            title="저장 (Ctrl+S)"
          >
            💾 저장
          </button>

          {/* 내보내기 */}
          <div className="dropdown dropdown-end">
            <label
              tabIndex={0}
              className="btn btn-sm btn-ghost"
              onClick={() => setExportDropdown(!exportDropdown)}
            >
              📥 내보내기
            </label>
            {exportDropdown && (
              <ul
                tabIndex={0}
                className="dropdown-content z-[100] menu p-2 shadow bg-base-100 rounded-box w-44"
              >
                <li>
                  <button onClick={() => handleExport("html")}>🌐 HTML</button>
                </li>
                <li>
                  <button onClick={() => handleExport("markdown")}>
                    📝 Markdown
                  </button>
                </li>
                <li>
                  <button onClick={() => handleExport("text")}>
                    📄 텍스트
                  </button>
                </li>
                <li>
                  <button onClick={() => handleExport("json")}>🔧 JSON</button>
                </li>
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* 에디터 영역 */}
      <div className="prose max-w-none w-full min-h-[50vh] p-4 bg-base-100 border border-base-300 border-t-0 rounded-b-lg">
        {editorData && (
          <ReactEditorJS
            onInitialize={handleInitialize}
            onChange={handleChange}
            tools={EDITOR_JS_TOOLS}
            defaultValue={editorData}
            placeholder="여기에 내용을 작성하세요..."
          />
        )}
      </div>

      {/* 하단 상태 바 */}
      <div className="flex items-center justify-between px-3 py-1 text-xs opacity-50 mt-1">
        <span>Ctrl+S: 저장 · 30초 자동 저장</span>
        {saveMessage && saveStatus === "error" && (
          <span className="text-error">{saveMessage}</span>
        )}
      </div>
    </div>
  );
}
