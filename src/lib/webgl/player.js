/**
 * Unity WebGL 플레이어 유틸리티
 * WebGL 빌드를 브라우저에서 로드하고 실행하는 기능 제공
 */

/**
 * WebGL 빌드 로드 및 실행
 * @param {Blob} zipBlob - ZIP 파일 Blob
 * @param {string} buildName - 빌드 이름
 * @param {string} containerElementId - 게임을 렌더링할 컨테이너 요소 ID
 * @param {Function} onProgress - 진행률 콜백 (0-100)
 * @returns {Promise<Object>} Unity 인스턴스 객체
 */
export async function loadWebGLBuild(zipBlob, buildName, containerElementId, onProgress) {
  try {
    onProgress?.(5);
    console.log("빌드 압축 해제:", buildName);
    
    // ZIP 압축 해제
    const JSZip = (await import("jszip")).default;
    const zip = new JSZip();
    const contents = await zip.loadAsync(zipBlob);
    
    onProgress?.(15);
    
    // 필요한 파일 추출
    const buildFiles = {};
    const files = Object.keys(contents.files);
    
    for (let i = 0; i < files.length; i++) {
      const fileName = files[i];
      const fileEntry = contents.files[fileName];
      
      // 디렉토리는 건너뛰기
      if (fileEntry.dir) {
        console.log("디렉토리 건너뛰기:", fileName);
        continue;
      }
      
      // 파일 데이터 추출
      const fileData = await fileEntry.async("blob");
      
      // 파일명 정규화: 경로 포함 시 마지막 파일명만 추출
      // 예: "Build/game.loader.js" -> "game.loader.js"
      // filter(Boolean)로 빈 문자열 제거 (trailing slash 처리)
      const normalizedFileName = fileName.includes('/') 
        ? fileName.split('/').filter(Boolean).pop() || fileName
        : fileName;
      
      buildFiles[normalizedFileName] = {
        blob: fileData,
        url: URL.createObjectURL(fileData),
        originalPath: fileName, // 원본 경로 보존
      };
      
      onProgress?.(15 + (i / files.length) * 25);
    }
    
    onProgress?.(40);
    
    // Unity 로더 스크립트 찾기 (경로 및 파일명 모두 확인)
    const loaderFile = Object.keys(buildFiles).find(
      (name) => {
        const originalPath = buildFiles[name].originalPath;
        return name.endsWith(".loader.js") || 
               originalPath.endsWith(".loader.js") ||
               name.match(/\.loader\.js$/) || 
               originalPath.match(/Build\/.*\.loader\.js$/);
      }
    );
    
    if (!loaderFile) {
      console.error("사용 가능한 파일:", Object.keys(buildFiles));
      throw new Error("Unity 로더 파일을 찾을 수 없습니다.");
    }
    
    // 필요한 파일들의 URL 매핑 (경로 및 파일명 모두 확인)
    const dataFile = Object.keys(buildFiles).find((name) => {
      const originalPath = buildFiles[name].originalPath;
      return name.endsWith(".data") || originalPath.endsWith(".data");
    });
    const frameworkFile = Object.keys(buildFiles).find((name) => {
      const originalPath = buildFiles[name].originalPath;
      return name.endsWith(".framework.js") || 
             originalPath.endsWith(".framework.js") ||
             originalPath.match(/Build\/.*\.framework\.js$/);
    });
    const wasmFile = Object.keys(buildFiles).find((name) => {
      const originalPath = buildFiles[name].originalPath;
      return name.endsWith(".wasm") || originalPath.endsWith(".wasm");
    });
    
    if (!dataFile || !frameworkFile || !wasmFile) {
      console.error("사용 가능한 파일:", Object.keys(buildFiles));
      console.error("찾은 파일:", { dataFile, frameworkFile, wasmFile, loaderFile });
      throw new Error("필수 WebGL 파일이 누락되었습니다.");
    }
    
    onProgress?.(50);
    
    // Unity 인스턴스 생성 설정
    const buildUrl = {
      dataUrl: buildFiles[dataFile].url,
      frameworkUrl: buildFiles[frameworkFile].url,
      codeUrl: buildFiles[wasmFile].url,
      loaderUrl: buildFiles[loaderFile].url,
    };
    
    // 로더 스크립트 동적 로드
    const loaderScriptBlob = buildFiles[loaderFile].blob;
    const loaderScriptText = await loaderScriptBlob.text();
    
    onProgress?.(60);
    
    // 로더 스크립트를 전역에 추가
    const scriptElement = document.createElement("script");
    scriptElement.textContent = loaderScriptText;
    document.head.appendChild(scriptElement);
    
    onProgress?.(70);
    
    // Unity 인스턴스 생성
    const container = document.getElementById(containerElementId);
    if (!container) {
      throw new Error(`컨테이너 요소를 찾을 수 없습니다: ${containerElementId}`);
    }
    
    // 캔버스 생성
    const canvas = document.createElement("canvas");
    canvas.id = "unity-canvas";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    container.innerHTML = "";
    container.appendChild(canvas);
    
    onProgress?.(80);
    
    // Unity 로더를 통해 게임 시작
    // createUnityInstance는 로더 스크립트에서 전역으로 정의됨
    if (typeof window.createUnityInstance === "function") {
      const config = {
        dataUrl: buildUrl.dataUrl,
        frameworkUrl: buildUrl.frameworkUrl,
        codeUrl: buildUrl.codeUrl,
        streamingAssetsUrl: "StreamingAssets",
        companyName: "DefaultCompany",
        productName: buildName,
        productVersion: "1.0",
      };
      
      onProgress?.(90);
      
      const unityInstance = await window.createUnityInstance(canvas, config, (progress) => {
        onProgress?.(90 + progress * 10);
      });
      
      onProgress?.(100);
      console.log("WebGL 빌드 로드 완료");
      
      // Unity 인스턴스 반환
      return unityInstance;
    } else {
      throw new Error("Unity 로더를 찾을 수 없습니다.");
    }
  } catch (error) {
    console.error("WebGL 빌드 로드 오류:", error);
    throw error;
  }
}

/**
 * Unity 인스턴스 정리 및 종료
 * @param {Object} unityInstance - Unity 인스턴스 객체
 */
export function unloadWebGLBuild(unityInstance) {
  try {
    if (unityInstance && typeof unityInstance.Quit === "function") {
      console.log("Unity 인스턴스 종료 중...");
      unityInstance.Quit().then(() => {
        console.log("Unity 인스턴스 종료 완료");
      }).catch((error) => {
        console.error("Unity 인스턴스 종료 오류:", error);
      });
    }
  } catch (error) {
    console.error("Unity 인스턴스 정리 오류:", error);
  }
}
