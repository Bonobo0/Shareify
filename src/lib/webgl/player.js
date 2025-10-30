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
      if (contents.files[fileName].dir) continue;
      
      const fileData = await contents.files[fileName].async("blob");
      buildFiles[fileName] = {
        blob: fileData,
        url: URL.createObjectURL(fileData),
      };
      
      onProgress?.(15 + (i / files.length) * 25);
    }
    
    onProgress?.(40);
    
    // Unity 로더 스크립트 찾기
    const loaderFile = Object.keys(buildFiles).find(
      (name) => name.endsWith(".loader.js") || name.match(/Build\/.*\.loader\.js$/)
    );
    
    if (!loaderFile) {
      throw new Error("Unity 로더 파일을 찾을 수 없습니다.");
    }
    
    // 필요한 파일들의 URL 매핑
    const dataFile = Object.keys(buildFiles).find((name) => name.endsWith(".data"));
    const frameworkFile = Object.keys(buildFiles).find((name) => 
      name.endsWith(".framework.js") || name.match(/Build\/.*\.framework\.js$/)
    );
    const wasmFile = Object.keys(buildFiles).find((name) => name.endsWith(".wasm"));
    
    if (!dataFile || !frameworkFile || !wasmFile) {
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
      
      await window.createUnityInstance(canvas, config, (progress) => {
        onProgress?.(90 + progress * 10);
      });
      
      onProgress?.(100);
      console.log("WebGL 빌드 로드 완료");
    } else {
      throw new Error("Unity 로더를 찾을 수 없습니다.");
    }
  } catch (error) {
    console.error("WebGL 빌드 로드 오류:", error);
    throw error;
  }
}
