/**
 * Unity WebGL 플레이어 유틸리티
 * WebGL 빌드를 브라우저에서 로드하고 실행하는 기능 제공
 */

// IndexedDB를 사용한 캐싱
const DB_NAME = "WebGLBuildCache";
const DB_VERSION = 1;
const STORE_NAME = "builds";

/**
 * IndexedDB 초기화
 */
async function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "name" });
      }
    };
  });
}

/**
 * 캐시에서 빌드 가져오기
 * @param {string} buildName - 빌드 이름 (파일명)
 * @returns {Promise<Object|null>} 캐시된 빌드 데이터
 */
async function getCachedBuild(buildName) {
  try {
    const db = await initDB();
    const transaction = db.transaction([STORE_NAME], "readonly");
    const store = transaction.objectStore(STORE_NAME);
    
    return new Promise((resolve, reject) => {
      const request = store.get(buildName);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error("캐시 조회 오류:", error);
    return null;
  }
}

/**
 * 빌드를 캐시에 저장
 * @param {string} buildName - 빌드 이름
 * @param {Object} buildData - 빌드 데이터
 */
async function cacheBuild(buildName, buildData) {
  try {
    const db = await initDB();
    const transaction = db.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    
    await new Promise((resolve, reject) => {
      const request = store.put({ name: buildName, data: buildData, timestamp: Date.now() });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error("캐시 저장 오류:", error);
  }
}

/**
 * 캐시 삭제
 * @param {string} buildName - 빌드 이름
 */
export async function clearWebGLCache(buildName) {
  try {
    const db = await initDB();
    const transaction = db.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    
    await new Promise((resolve, reject) => {
      const request = store.delete(buildName);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error("캐시 삭제 오류:", error);
  }
}

/**
 * WebGL 빌드 로드 및 실행
 * @param {Blob} zipBlob - ZIP 파일 Blob
 * @param {string} buildName - 빌드 이름
 * @param {string} containerElementId - 게임을 렌더링할 컨테이너 요소 ID
 * @param {Function} onProgress - 진행률 콜백 (0-100)
 */
export async function loadWebGLBuild(zipBlob, buildName, containerElementId, onProgress) {
  try {
    // 1. 캐시 확인
    onProgress?.(5);
    const cached = await getCachedBuild(buildName);
    
    let buildFiles;
    
    if (cached) {
      console.log("캐시된 빌드 사용:", buildName);
      buildFiles = cached.data;
      onProgress?.(30);
    } else {
      console.log("새로운 빌드 압축 해제:", buildName);
      
      // 2. ZIP 압축 해제
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      const contents = await zip.loadAsync(zipBlob);
      
      onProgress?.(15);
      
      // 3. 필요한 파일 추출
      buildFiles = {};
      const files = Object.keys(contents.files);
      
      for (let i = 0; i < files.length; i++) {
        const fileName = files[i];
        if (contents.files[fileName].dir) continue;
        
        const fileData = await contents.files[fileName].async("blob");
        buildFiles[fileName] = {
          blob: fileData,
          url: URL.createObjectURL(fileData),
        };
        
        onProgress?.(15 + (i / files.length) * 15);
      }
      
      // 4. 캐시에 저장
      await cacheBuild(buildName, buildFiles);
    }
    
    onProgress?.(40);
    
    // 5. Unity 로더 스크립트 찾기
    const loaderFile = Object.keys(buildFiles).find(
      (name) => name.endsWith(".loader.js") || name.match(/Build\/.*\.loader\.js$/)
    );
    
    if (!loaderFile) {
      throw new Error("Unity 로더 파일을 찾을 수 없습니다.");
    }
    
    // 6. 필요한 파일들의 URL 매핑
    const dataFile = Object.keys(buildFiles).find((name) => name.endsWith(".data"));
    const frameworkFile = Object.keys(buildFiles).find((name) => 
      name.endsWith(".framework.js") || name.match(/Build\/.*\.framework\.js$/)
    );
    const wasmFile = Object.keys(buildFiles).find((name) => name.endsWith(".wasm"));
    
    if (!dataFile || !frameworkFile || !wasmFile) {
      throw new Error("필수 WebGL 파일이 누락되었습니다.");
    }
    
    onProgress?.(50);
    
    // 7. Unity 인스턴스 생성 설정
    const buildUrl = {
      dataUrl: buildFiles[dataFile].url,
      frameworkUrl: buildFiles[frameworkFile].url,
      codeUrl: buildFiles[wasmFile].url,
      loaderUrl: buildFiles[loaderFile].url,
    };
    
    // 8. 로더 스크립트 동적 로드
    const loaderScriptBlob = buildFiles[loaderFile].blob;
    const loaderScriptText = await loaderScriptBlob.text();
    
    onProgress?.(60);
    
    // 9. 로더 스크립트를 전역에 추가
    const scriptElement = document.createElement("script");
    scriptElement.textContent = loaderScriptText;
    document.head.appendChild(scriptElement);
    
    onProgress?.(70);
    
    // 10. Unity 인스턴스 생성
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
    
    // 11. Unity 로더를 통해 게임 시작
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
