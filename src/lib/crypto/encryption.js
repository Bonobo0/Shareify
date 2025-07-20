/**
 * 클라이언트 측 E2EE (종단간 암호화) 유틸리티
 * AES-GCM 알고리즘을 사용하여 파일을 암호화/복호화
 */

// 암호화 키 생성 (사용자 비밀번호 기반)
export async function deriveKeyFromPassword(password, salt) {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );

  return await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

// 랜덤 salt 생성
export function generateSalt() {
  return crypto.getRandomValues(new Uint8Array(16));
}

// 랜덤 IV 생성
export function generateIV() {
  return crypto.getRandomValues(new Uint8Array(12));
}

// 파일 암호화
export async function encryptFile(file, password) {
  try {
    // Web Crypto API 지원 확인
    if (!window.crypto || !window.crypto.subtle) {
      throw new Error("이 브라우저는 암호화 기능을 지원하지 않습니다.");
    }

    // 파일 크기 제한 (100MB)
    const MAX_FILE_SIZE = 100 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      throw new Error("암호화할 수 있는 파일 크기는 최대 100MB입니다.");
    }

    console.log("암호화 시작:", file.name, "크기:", file.size);

    const salt = generateSalt();
    const iv = generateIV();
    const key = await deriveKeyFromPassword(password, salt);

    // 파일을 ArrayBuffer로 읽기
    const fileBuffer = await file.arrayBuffer();
    console.log("파일 읽기 완료, 암호화 진행 중...");

    // 암호화
    const encryptedData = await crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv: iv,
      },
      key,
      fileBuffer
    );

    console.log("암호화 완료, 결과 파일 생성 중...");

    // salt + iv + encryptedData를 하나의 배열로 결합
    const resultBuffer = new Uint8Array(
      salt.length + iv.length + encryptedData.byteLength
    );

    resultBuffer.set(salt, 0);
    resultBuffer.set(iv, salt.length);
    resultBuffer.set(new Uint8Array(encryptedData), salt.length + iv.length);

    // 암호화된 파일 객체 생성
    const encryptedFile = new File([resultBuffer], file.name + ".encrypted", {
      type: "application/octet-stream",
    });

    console.log("암호화된 파일 생성 완료:", encryptedFile.size, "bytes");

    return {
      success: true,
      encryptedFile,
      metadata: {
        originalName: file.name,
        originalSize: file.size,
        originalType: file.type,
        encryptedSize: resultBuffer.length,
        isEncrypted: true,
      },
    };
  } catch (error) {
    console.error("파일 암호화 오류:", error);

    // 구체적인 에러 메시지 제공
    if (error.name === "NotSupportedError") {
      return {
        success: false,
        error: "이 브라우저는 필요한 암호화 알고리즘을 지원하지 않습니다.",
      };
    } else if (error.name === "QuotaExceededError") {
      return {
        success: false,
        error: "메모리가 부족합니다. 더 작은 파일을 시도해주세요.",
      };
    } else if (error.message.includes("크기")) {
      return {
        success: false,
        error: error.message,
      };
    } else {
      return {
        success: false,
        error: "파일 암호화 중 오류가 발생했습니다: " + error.message,
      };
    }
  }
}

// 파일 복호화
export async function decryptFile(
  encryptedArrayBuffer,
  password,
  originalMetadata
) {
  try {
    const data = new Uint8Array(encryptedArrayBuffer);

    // salt, iv, 암호화된 데이터 분리
    const salt = data.slice(0, 16);
    const iv = data.slice(16, 28);
    const encryptedData = data.slice(28);

    // 키 생성
    const key = await deriveKeyFromPassword(password, salt);

    // 복호화
    const decryptedData = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: iv,
      },
      key,
      encryptedData
    );

    // 원본 파일 객체 생성
    const decryptedFile = new File(
      [decryptedData],
      originalMetadata.originalName,
      { type: originalMetadata.originalType }
    );

    return {
      success: true,
      decryptedFile,
    };
  } catch (error) {
    console.error("파일 복호화 오류:", error);
    return {
      success: false,
      error: "복호화에 실패했습니다. 비밀번호를 확인해주세요.",
    };
  }
}

// 미디어 파일 확인
export function isMediaFile(mimetype) {
  const mediaTypes = ["image/", "video/", "audio/"];
  return mediaTypes.some((type) => mimetype.startsWith(type));
}

// 암호화된 미디어 파일 미리보기용 복호화 (URL에서 다운로드해서 복호화)
export async function decryptForPreview(downloadUrl, password, metadata = {}) {
  try {
    // 암호화된 파일 다운로드
    const response = await fetch(downloadUrl);
    if (!response.ok) {
      throw new Error("파일 다운로드 실패");
    }

    const encryptedArrayBuffer = await response.arrayBuffer();

    // 복호화
    const result = await decryptFile(encryptedArrayBuffer, password, {
      originalName: metadata.originalName || "preview",
      originalType: metadata.originalMimetype || "application/octet-stream",
    });

    if (result.success) {
      return result.decryptedFile; // Blob 객체 반환
    }

    throw new Error(result.error || "복호화 실패");
  } catch (error) {
    console.error("미리보기 복호화 오류:", error);
    throw error;
  }
}

// 파일 다운로드용 복호화
export async function downloadAndDecrypt(url, password, metadata) {
  try {
    // 암호화된 파일 다운로드
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error("파일 다운로드 실패");
    }

    const encryptedArrayBuffer = await response.arrayBuffer();

    // 복호화
    const result = await decryptFile(encryptedArrayBuffer, password, metadata);

    if (result.success) {
      // 브라우저에서 파일 다운로드
      const url = URL.createObjectURL(result.decryptedFile);
      const a = document.createElement("a");
      a.href = url;
      a.download = metadata.originalName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      return { success: true };
    }

    return result;
  } catch (error) {
    console.error("다운로드 및 복호화 오류:", error);
    return {
      success: false,
      error: "파일 다운로드 및 복호화 중 오류가 발생했습니다.",
    };
  }
}
