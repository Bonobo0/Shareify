/**
 * Bootstrap document for an untrusted Unity loader.
 *
 * The parent page only sends build bytes through postMessage. Keeping the
 * loader and its Blob URLs in a sandboxed, opaque-origin frame prevents an
 * uploaded build from reading the Shareify document, cookies, or storage.
 */
export const WEBGL_SANDBOX = "allow-scripts allow-pointer-lock";
export const WEBGL_PARENT_MESSAGE_SOURCE = "shareify-webgl-parent";
export const WEBGL_FRAME_MESSAGE_SOURCE = "shareify-webgl-frame";

export const WEBGL_BOOTSTRAP_HTML = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      html, body, #unity-container { width: 100%; height: 100%; margin: 0; padding: 0; overflow: hidden; background: #000; }
      canvas { width: 100%; height: 100%; display: block; }
    </style>
  </head>
  <body>
    <div id="unity-container"></div>
    <script>
      (() => {
        const parentMessageSource = "${WEBGL_PARENT_MESSAGE_SOURCE}";
        const frameMessageSource = "${WEBGL_FRAME_MESSAGE_SOURCE}";
        const objectUrls = [];
        let unityInstance = null;
        let isLoading = false;

        const post = (type, payload = {}) => {
          window.parent.postMessage({ source: frameMessageSource, type, ...payload }, "*");
        };

        const basename = (name) => {
          const parts = String(name || "").split(/[\\/]+/).filter(Boolean);
          return parts[parts.length - 1] || String(name || "");
        };

        const findBuildFile = (files, suffix) =>
          files.find((entry) =>
            basename(entry.name).toLowerCase().endsWith(suffix) ||
            String(entry.name || "").toLowerCase().endsWith(suffix),
          );

        const revokeObjectUrls = () => {
          while (objectUrls.length > 0) {
            window.URL.revokeObjectURL(objectUrls.pop());
          }
        };

        const loadBuild = async ({ files, buildName }) => {
          if (isLoading) throw new Error("WebGL 빌드가 이미 로드 중입니다.");
          isLoading = true;

          try {
            const entries = files.map((entry) => {
              const blob = new Blob([entry.data], {
                type: entry.type || "application/octet-stream",
              });
              const url = window.URL.createObjectURL(blob);
              objectUrls.push(url);
              return { ...entry, url };
            });

            const loaderFile = entries.find(
              (entry) =>
                basename(entry.name).toLowerCase().endsWith(".loader.js") ||
                String(entry.name || "").toLowerCase().endsWith(".loader.js"),
            );
            const dataFile = findBuildFile(entries, ".data");
            const frameworkFile = findBuildFile(entries, ".framework.js");
            const wasmFile = findBuildFile(entries, ".wasm");

            if (!loaderFile || !dataFile || !frameworkFile || !wasmFile) {
              throw new Error("필수 WebGL 파일이 누락되었습니다.");
            }

            post("progress", { progress: 60 });

            const scriptElement = document.createElement("script");
            // This is intentionally executed only inside this opaque-origin
            // sandbox. It must never be appended to the parent document.
            scriptElement.textContent = loaderFile.scriptText;
            document.head.appendChild(scriptElement);

            post("progress", { progress: 70 });

            const canvas = document.createElement("canvas");
            canvas.id = "unity-canvas";
            canvas.style.width = "100%";
            canvas.style.height = "100%";
            document.getElementById("unity-container").replaceChildren(canvas);

            if (typeof window.createUnityInstance !== "function") {
              throw new Error("Unity 로더를 찾을 수 없습니다.");
            }

            post("progress", { progress: 80 });

            const config = {
              dataUrl: dataFile.url,
              frameworkUrl: frameworkFile.url,
              codeUrl: wasmFile.url,
              streamingAssetsUrl: "StreamingAssets",
              companyName: "DefaultCompany",
              productName: buildName,
              productVersion: "1.0",
            };

            unityInstance = await window.createUnityInstance(
              canvas,
              config,
              (progress) =>
                post("progress", { progress: 90 + progress * 10 }),
            );

            post("progress", { progress: 100 });
            post("ready");
          } catch (error) {
            revokeObjectUrls();
            throw error;
          } finally {
            isLoading = false;
          }
        };

        const quitBuild = async () => {
          try {
            if (unityInstance && typeof unityInstance.Quit === "function") {
              await unityInstance.Quit();
            }
          } finally {
            unityInstance = null;
            revokeObjectUrls();
            post("quit-complete");
          }
        };

        window.addEventListener("message", async (event) => {
          if (event.source !== window.parent) return;
          if (!event.data || event.data.source !== parentMessageSource) return;

          try {
            if (event.data.type === "load") {
              await loadBuild(event.data);
            } else if (event.data.type === "quit") {
              await quitBuild();
            }
          } catch (error) {
            post("error", {
              message: error?.message || "WebGL 빌드를 로드할 수 없습니다.",
            });
          }
        });

        post("bootstrap-ready");
      })();
    </script>
  </body>
</html>`;
