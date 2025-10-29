/**
 * Unity WebGL 빌드 검증 유틸리티
 * WebGL 빌드 압축 파일의 구조를 검증합니다.
 */

/**
 * WebGL 빌드 파일인지 검증
 * @param {ArrayBuffer} fileBuffer - 업로드된 파일의 버퍼
 * @returns {Promise<{isValid: boolean, error?: string}>}
 */
export async function validateWebGLBuild(fileBuffer) {
  try {
    // JSZip을 동적으로 import (클라이언트 사이드에서만 사용)
    const JSZip = (await import("jszip")).default;
    
    const zip = new JSZip();
    const contents = await zip.loadAsync(fileBuffer);
    
    // WebGL 빌드의 필수 파일 패턴
    const requiredPatterns = [
      /\.data$/i,           // 데이터 파일
      /\.wasm$/i,           // WebAssembly 파일
      /\.js$/i,             // 로더 JavaScript 파일
      /\.framework\.js$/i,  // Framework JavaScript 파일
    ];
    
    const files = Object.keys(contents.files);
    const foundPatterns = new Set();
    
    // 파일 이름 패턴 매칭
    for (const file of files) {
      if (contents.files[file].dir) continue; // 디렉토리는 스킵
      
      for (let i = 0; i < requiredPatterns.length; i++) {
        if (requiredPatterns[i].test(file)) {
          foundPatterns.add(i);
        }
      }
    }
    
    // 최소한 .data, .wasm, .js 파일이 있어야 함
    const hasDataFile = Array.from(foundPatterns).some(i => i === 0);
    const hasWasmFile = Array.from(foundPatterns).some(i => i === 1);
    const hasJsFile = Array.from(foundPatterns).some(i => i === 2 || i === 3);
    
    if (!hasDataFile || !hasWasmFile || !hasJsFile) {
      return {
        isValid: false,
        error: "유효한 Unity WebGL 빌드가 아닙니다. 필수 파일(.data, .wasm, .js)이 누락되었습니다.",
      };
    }
    
    // index.html 파일 확인 (선택사항이지만 일반적으로 포함됨)
    const hasIndexHtml = files.some(f => f.toLowerCase().endsWith("index.html"));
    
    return {
      isValid: true,
      hasIndexHtml,
    };
  } catch (error) {
    console.error("WebGL 빌드 검증 오류:", error);
    return {
      isValid: false,
      error: "압축 파일을 읽는 중 오류가 발생했습니다.",
    };
  }
}

/**
 * 클라이언트 측에서 WebGL 빌드를 검증하고 업로드 전에 확인
 * @param {File} file - 업로드할 파일 객체
 * @returns {Promise<{isValid: boolean, error?: string}>}
 */
export async function validateWebGLBuildFile(file) {
  // 파일 확장자 확인
  if (!file.name.toLowerCase().endsWith(".zip")) {
    return {
      isValid: false,
      error: "WebGL 빌드는 ZIP 압축 파일이어야 합니다.",
    };
  }
  
  // 파일을 ArrayBuffer로 읽기
  const arrayBuffer = await file.arrayBuffer();
  
  // 검증 수행
  return await validateWebGLBuild(arrayBuffer);
}
