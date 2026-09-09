import {
  WEBGL_BOOTSTRAP_HTML,
  WEBGL_FRAME_MESSAGE_SOURCE,
  WEBGL_PARENT_MESSAGE_SOURCE,
  WEBGL_SANDBOX,
} from "./sandbox.mjs";

/**
 * Unity WebGL 플레이어 유틸리티
 *
 * WebGL 빌드는 업로드한 사용자가 만든 JavaScript를 포함하므로, 로더를
 * Shareify 문서에 직접 삽입하지 않는다. ZIP의 바이트와 Blob URL은
 * opaque-origin sandbox iframe 안에서만 만들어지고 사용된다.
 */

const LOAD_TIMEOUT_MS = 120_000;
const QUIT_TIMEOUT_MS = 5_000;

const getBaseName = (fileName) => {
  const parts = String(fileName || "").split(/[\\/]+/).filter(Boolean);
  return parts[parts.length - 1] || String(fileName || "");
};

const getMimeType = (fileName) => {
  const lowerName = String(fileName || "").toLowerCase();

  if (lowerName.endsWith(".loader.js") || lowerName.endsWith(".framework.js")) {
    return "text/javascript";
  }
  if (lowerName.endsWith(".wasm")) return "application/wasm";
  if (lowerName.endsWith(".data")) return "application/octet-stream";
  return "application/octet-stream";
};

const hasSuffix = (fileName, suffix) => {
  const lowerName = String(fileName || "").toLowerCase();
  return lowerName.endsWith(suffix) || getBaseName(lowerName).endsWith(suffix);
};

/**
 * WebGL 빌드 로드 및 실행
 * @param {Blob} zipBlob - ZIP 파일 Blob
 * @param {string} buildName - 빌드 이름
 * @param {string} containerElementId - 게임을 렌더링할 컨테이너 요소 ID
 * @param {Function} onProgress - 진행률 콜백 (0-100)
 * @returns {Promise<Object>} sandbox 컨트롤러
 */
export async function loadWebGLBuild(
  zipBlob,
  buildName,
  containerElementId,
  onProgress,
  options = {},
) {
  const { signal } = options;
  let iframe = null;
  let messageHandler = null;
  let loadTimeoutId = null;
  let abortHandler = null;

  const createAbortError = () => {
    const error = new Error("WebGL 빌드 로드가 취소되었습니다.");
    error.name = "AbortError";
    return error;
  };

  const throwIfAborted = () => {
    if (signal?.aborted) throw createAbortError();
  };

  const removeFrame = () => {
    if (iframe?.parentNode) iframe.parentNode.removeChild(iframe);
    iframe = null;
  };

  const removeMessageHandler = () => {
    if (messageHandler) {
      window.removeEventListener("message", messageHandler);
      messageHandler = null;
    }
  };

  const removeAbortHandler = () => {
    if (abortHandler) {
      signal?.removeEventListener("abort", abortHandler);
      abortHandler = null;
    }
  };

  const clearLoadTimeout = () => {
    if (loadTimeoutId !== null) {
      window.clearTimeout(loadTimeoutId);
      loadTimeoutId = null;
    }
  };

  try {
    throwIfAborted();
    onProgress?.(5);
    console.log("빌드 압축 해제:", buildName);

    const JSZip = (await import("jszip")).default;
    const zip = new JSZip();
    const contents = await zip.loadAsync(zipBlob);
    throwIfAborted();
    const zipEntries = Object.entries(contents.files);

    onProgress?.(15);

    // Transferable ArrayBuffer만 부모에서 iframe으로 전달한다. URL을
    // 부모에서 만들면 sandbox 밖의 origin으로 생성될 수 있으므로, 실제
    // Blob/URL 생성은 bootstrap 문서가 담당한다.
    const buildFiles = [];
    for (let i = 0; i < zipEntries.length; i += 1) {
      throwIfAborted();
      const [fileName, fileEntry] = zipEntries[i];

      if (fileEntry.dir) continue;

      const data = await fileEntry.async("arraybuffer");
      throwIfAborted();
      const file = {
        name: fileName,
        type: getMimeType(fileName),
        data,
      };

      if (hasSuffix(fileName, ".loader.js")) {
        file.scriptText = new TextDecoder().decode(data);
      }

      buildFiles.push(file);
      onProgress?.(15 + ((i + 1) / Math.max(zipEntries.length, 1)) * 25);
    }

    onProgress?.(40);

    const loaderFile = buildFiles.find((file) => hasSuffix(file.name, ".loader.js"));
    const dataFile = buildFiles.find((file) => hasSuffix(file.name, ".data"));
    const frameworkFile = buildFiles.find((file) =>
      hasSuffix(file.name, ".framework.js"),
    );
    const wasmFile = buildFiles.find((file) => hasSuffix(file.name, ".wasm"));

    if (!loaderFile || !dataFile || !frameworkFile || !wasmFile) {
      console.error("사용 가능한 파일:", buildFiles.map((file) => file.name));
      throw new Error("필수 WebGL 파일이 누락되었습니다.");
    }

    const container = document.getElementById(containerElementId);
    throwIfAborted();
    if (!container) {
      throw new Error(`컨테이너 요소를 찾을 수 없습니다: ${containerElementId}`);
    }

    iframe = document.createElement("iframe");
    iframe.setAttribute("sandbox", WEBGL_SANDBOX);
    iframe.setAttribute("allowfullscreen", "true");
    iframe.setAttribute("allow", "fullscreen; autoplay; gamepad");
    iframe.setAttribute("title", `${buildName || "WebGL"} 플레이어`);
    iframe.style.width = "100%";
    iframe.style.height = "100%";
    iframe.style.display = "block";
    iframe.style.border = "0";
    container.replaceChildren(iframe);

    onProgress?.(50);

    const controller = await new Promise((resolve, reject) => {
      let isReady = false;
      let isClosed = false;
      let quitPromise = null;
      let resolveQuit = null;

      const closeController = () => {
        if (isClosed) return;
        isClosed = true;
        removeMessageHandler();
        removeAbortHandler();
        clearLoadTimeout();
        removeFrame();
      };

      const rejectLoad = (error) => {
        if (isReady || isClosed) return;
        closeController();
        reject(error instanceof Error ? error : new Error(String(error)));
      };

      const sendToFrame = (message, transferables = []) => {
        if (!iframe?.contentWindow || isClosed) return false;
        const payload = { source: WEBGL_PARENT_MESSAGE_SOURCE, ...message };
        if (transferables.length > 0) {
          iframe.contentWindow.postMessage(payload, "*", transferables);
        } else {
          iframe.contentWindow.postMessage(payload, "*");
        }
        return true;
      };

      const finishQuit = () => {
        if (resolveQuit) resolveQuit();
        resolveQuit = null;
        quitPromise = null;
        closeController();
      };

      const quit = () => {
        if (isClosed) return Promise.resolve();
        if (quitPromise) return quitPromise;

        quitPromise = new Promise((resolve) => {
          resolveQuit = resolve;
          const quitTimeoutId = window.setTimeout(finishQuit, QUIT_TIMEOUT_MS);
          const previousResolveQuit = resolveQuit;
          resolveQuit = () => {
            window.clearTimeout(quitTimeoutId);
            previousResolveQuit();
          };

          if (!sendToFrame({ type: "quit" })) finishQuit();
        });

        return quitPromise;
      };

      let didSendBuild = false;
      messageHandler = (event) => {
        if (!iframe || event.source !== iframe.contentWindow) return;

        const message = event.data;
        if (!message || message.source !== WEBGL_FRAME_MESSAGE_SOURCE) return;

        if (message.type === "bootstrap-ready") {
          if (didSendBuild) return;
          didSendBuild = true;
          const transferables = buildFiles.map((file) => file.data);
          try {
            sendToFrame(
              {
                type: "load",
                buildName: String(buildName || "WebGL Build"),
                files: buildFiles,
              },
              transferables,
            );
          } catch (error) {
            rejectLoad(error);
          }
          return;
        }

        if (message.type === "progress") {
          onProgress?.(Math.max(0, Math.min(100, Number(message.progress) || 0)));
          return;
        }

        if (message.type === "error") {
          const error = new Error(
            message.message || "WebGL 빌드를 로드할 수 없습니다.",
          );
          if (isReady) {
            console.error("WebGL 샌드박스 오류:", error);
          } else {
            rejectLoad(error);
          }
          return;
        }

        if (message.type === "ready") {
          if (signal?.aborted) {
            rejectLoad(createAbortError());
            return;
          }
          isReady = true;
          clearLoadTimeout();
          onProgress?.(100);
          console.log("WebGL 빌드 로드 완료");
          resolve({
            iframe,
            quit,
            cleanup: closeController,
          });
          return;
        }

        if (message.type === "quit-complete" && quitPromise) finishQuit();
      };

      window.addEventListener("message", messageHandler);
      abortHandler = () => {
        if (isReady) {
          closeController();
        } else {
          rejectLoad(createAbortError());
        }
      };
      signal?.addEventListener("abort", abortHandler, { once: true });

      if (signal?.aborted) {
        abortHandler();
        return;
      }

      loadTimeoutId = window.setTimeout(() => {
        rejectLoad(new Error("WebGL 빌드 로드 시간이 초과되었습니다."));
      }, LOAD_TIMEOUT_MS);

      // srcdoc is assigned only after the listener is installed so that the
      // bootstrap-ready message cannot race with listener registration.
      iframe.srcdoc = WEBGL_BOOTSTRAP_HTML;
    });

    return controller;
  } catch (error) {
    removeMessageHandler();
    removeAbortHandler();
    clearLoadTimeout();
    removeFrame();
    console.error("WebGL 빌드 로드 오류:", error);
    throw error;
  }
}

/**
 * Unity 인스턴스 정리 및 종료
 * @param {Object} unityInstance - sandbox 컨트롤러 또는 기존 Unity 인스턴스
 */
export function unloadWebGLBuild(unityInstance) {
  try {
    if (unityInstance && typeof unityInstance.quit === "function") {
      console.log("WebGL 샌드박스 종료 중...");
      Promise.resolve(unityInstance.quit()).catch((error) => {
        console.error("WebGL 샌드박스 종료 오류:", error);
      });
      return;
    }

    // 기존 호출자와의 호환성을 위해 직접 Unity 인스턴스도 정리한다.
    if (unityInstance && typeof unityInstance.Quit === "function") {
      console.log("Unity 인스턴스 종료 중...");
      Promise.resolve(unityInstance.Quit()).catch((error) => {
        console.error("Unity 인스턴스 종료 오류:", error);
      });
    }
  } catch (error) {
    console.error("WebGL 인스턴스 정리 오류:", error);
  }
}
