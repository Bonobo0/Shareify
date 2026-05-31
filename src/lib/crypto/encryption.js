/**
 * 클라이언트 측 E2EE (종단간 암호화) 유틸리티
 * AES-CTR 알고리즘을 사용하여 파일을 암호화/복호화
 * 
 * 포맷 구조:
 * V1 (기존): [mode: 1B][salt: 16B][counter: 16B][chunkCount|FLAG: 4B][authTag: 32B][encrypted chunks...]
 * V2 (강화): [0xFF: 1B][mode: 1B][salt: 16B][counter: 16B][HMAC: 32B][chunkCount: 4B][encrypted chunks...]
 * 
 * V2 강화사항:
 * - HMAC-SHA256 무결성 검증
 * - scrypt 키 유도 옵션 (GPU/ASIC 공격 저항)
 * - 비밀번호 강도 검증
 */

// 암호화 모드 식별 상수 (V1 포맷의 첫 바이트로 사용)
const ENCRYPTION_MODE = {
  AES_GCM: 1,
  AES_CTR: 2,
};

// V2 포맷 식별자 (V1과 겹치지 않도록 0xFF 사용)
const V2_MAGIC = 0xFF;

const AUTH_TAG_SIZE = 32;
const HMAC_SIZE = 32;
const AUTH_TAG_CONTEXT = "shareify-e2ee-v1";
const AUTH_TAG_FLAG = 0x80000000;
const CHUNK_SIZE = 5 * 1024 * 1024;

// scrypt 파라미터
const SCRYPT_PARAMS = {
  N: 2 ** 16,
  r: 16,
  p: 1,
};

function concatUint8Arrays(...arrays) {
  const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const array of arrays) {
    result.set(array, offset);
    offset += array.length;
  }
  return result;
}

// V1 authTag 생성 (하위 호환용)
async function deriveAuthTag(password, salt) {
  const encoder = new TextEncoder();
  const passwordBytes = encoder.encode(password);
  const contextBytes = encoder.encode(AUTH_TAG_CONTEXT);
  const data = concatUint8Arrays(salt, passwordBytes, contextBytes);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return new Uint8Array(digest);
}

// HMAC-SHA256 생성 (V2 무결성 검증용)
async function generateHMAC(salt, password) {
  const encoder = new TextEncoder();
  const passwordBytes = encoder.encode(password);
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    passwordBytes,
    { name: 'PBKDF2' },
    false,
    ['sign']
  );
  const hmacKey = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'HMAC', hash: 'SHA-256', length: 256 },
    false,
    ['sign']
  );
  const hmac = await crypto.subtle.sign('HMAC', hmacKey, salt);
  return new Uint8Array(hmac);
}

// 카운터 증가 유틸리티 (i번째 청크의 카운터 계산)
function computeChunkCounter(initialCounter, chunkIndex) {
  const counter = new Uint8Array(initialCounter);
  for (let j = 0; j < chunkIndex; j++) {
    for (let k = 15; k >= 8; k--) {
      if (counter[k] === 255) {
        counter[k] = 0;
        continue;
      }
      counter[k]++;
      break;
    }
  }
  return counter;
}

// PBKDF2 또는 scrypt로 키 유도
async function deriveKey(password, salt, algorithm = "AES-CTR", useScrypt = false) {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );

  // scrypt 사용 시도
  if (useScrypt) {
    try {
      const scryptKeyMaterial = await crypto.subtle.importKey(
        "raw",
        encoder.encode(password),
        { name: "PBKDF2" },
        false,
        ["deriveBits"]
      );
      const derivedBits = await crypto.subtle.deriveBits(
        { name: "scrypt", salt, N: SCRYPT_PARAMS.N, r: SCRYPT_PARAMS.r, p: SCRYPT_PARAMS.p },
        scryptKeyMaterial,
        256
      );
      return await crypto.subtle.importKey(
        "raw", derivedBits,
        { name: "AES-CTR", length: 256 },
        false, ["encrypt", "decrypt"]
      );
    } catch (e) {
      // scrypt 미지원 시 PBKDF2로 fallback
    }
  }

  return await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
    keyMaterial,
    { name: algorithm, length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

// 랜덤 salt 생성
export function generateSalt() {
  return crypto.getRandomValues(new Uint8Array(16));
}

// 랜덤 counter 생성
export function generateCounter() {
  return crypto.getRandomValues(new Uint8Array(16));
}

// 랜덤 IV 생성 (AES-GCM용)
export function generateIV() {
  return crypto.getRandomValues(new Uint8Array(12));
}

/**
 * 파일 암호화
 * @param {File} file - 암호화할 파일
 * @param {string} password - 비밀번호
 * @param {Object} options - 옵션
 * @param {boolean} options.useScrypt - scrypt 키 유도 사용 여부 (기본: false)
 * @param {number} options.version - 암호화 버전 (1=V1, 2=V2, 기본: 2)
 */
export async function encryptFile(file, password, options = {}) {
  try {
    if (!window.crypto || !window.crypto.subtle) {
      throw new Error("이 브라우저는 암호화 기능을 지원하지 않습니다.");
    }

    const useScrypt = options.useScrypt || false;
    const version = options.version || 2; // 기본 V2
    const isV2 = (version === 2);

    const salt = generateSalt();
    const counter = generateCounter();
    const key = await deriveKey(password, salt, "AES-CTR", useScrypt);
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

    // 헤더 생성
    let header;
    if (isV2) {
      const hmac = await generateHMAC(salt, password);
      header = new Uint8Array(1 + 1 + 16 + 16 + HMAC_SIZE + 4);
      header[0] = V2_MAGIC;
      header[1] = ENCRYPTION_MODE.AES_CTR;
      header.set(salt, 2);
      header.set(counter, 18);
      header.set(hmac, 34);
      header.set(new Uint8Array(new Uint32Array([totalChunks]).buffer), 66);
    } else {
      const authTag = await deriveAuthTag(password, salt);
      header = new Uint8Array(1 + 16 + 16 + 4 + AUTH_TAG_SIZE);
      header[0] = ENCRYPTION_MODE.AES_CTR;
      header.set(salt, 1);
      header.set(counter, 17);
      const encodedChunkCount = totalChunks | AUTH_TAG_FLAG;
      header.set(new Uint8Array(new Uint32Array([encodedChunkCount]).buffer), 33);
      header.set(authTag, 37);
    }

    // 청크 단위 스트리밍 암호화
    const stream = new ReadableStream({
      async start(controller) {
        try {
          controller.enqueue(header);

          for (let i = 0; i < totalChunks; i++) {
            const start = i * CHUNK_SIZE;
            const end = Math.min(start + CHUNK_SIZE, file.size);
            const chunk = await file.slice(start, end).arrayBuffer();
            const chunkCounter = computeChunkCounter(counter, i);

            const encryptedChunk = await crypto.subtle.encrypt(
              { name: "AES-CTR", counter: chunkCounter, length: 64 },
              key,
              chunk
            );

            controller.enqueue(new Uint8Array(encryptedChunk));
          }
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });

    const encryptedFile = new File(
      [await new Response(stream).blob()],
      file.name + ".encrypted",
      { type: "application/octet-stream" }
    );

    return {
      success: true,
      encryptedFile,
      metadata: {
        originalName: file.name,
        originalSize: file.size,
        originalType: file.type,
        encryptedSize: encryptedFile.size,
        isEncrypted: true,
        version: version,
        useScrypt: useScrypt,
      },
    };
  } catch (error) {
    console.error("파일 암호화 오류:", error);
    return {
      success: false,
      error: "파일 암호화 중 오류가 발생했습니다: " + error.message,
    };
  }
}

/**
 * 파일 복호화 (V1/V2 자동 감지)
 */
export async function decryptFile(encryptedArrayBuffer, password, originalMetadata) {
  try {
    const data = new Uint8Array(encryptedArrayBuffer);
    const CHUNK_SIZE = 5 * 1024 * 1024;

    let offset = 0;
    let salt, counter, key, totalChunks;
    const firstByte = data[0];

    if (firstByte === V2_MAGIC) {
      // ===== V2 포맷 =====
      offset = 1;
      const encryptionMode = data[offset++];
      if (encryptionMode !== ENCRYPTION_MODE.AES_CTR) {
        throw new Error("지원되지 않는 암호화 모드입니다.");
      }

      salt = data.slice(offset, offset + 16);
      offset += 16;
      counter = data.slice(offset, offset + 16);
      offset += 16;

      // HMAC 검증
      const hmac = data.slice(offset, offset + HMAC_SIZE);
      offset += HMAC_SIZE;
      const expectedHMAC = await generateHMAC(salt, password);
      if (hmac.length !== expectedHMAC.length) {
        throw new Error("무결성 검증에 실패했습니다.");
      }
      for (let i = 0; i < hmac.length; i++) {
        if (hmac[i] !== expectedHMAC[i]) {
          throw new Error("암호화 비밀번호가 올바르지 않습니다.");
        }
      }

      totalChunks = new Uint32Array(data.slice(offset, offset + 4).buffer)[0];
      offset += 4;

      const useScrypt = originalMetadata.useScrypt || false;
      key = await deriveKey(password, salt, "AES-CTR", useScrypt);

    } else if (firstByte === ENCRYPTION_MODE.AES_CTR) {
      // ===== V1 AES-CTR 포맷 =====
      offset = 1;
      salt = data.slice(offset, offset + 16);
      offset += 16;
      counter = data.slice(offset, offset + 16);
      offset += 16;

      let encodedChunksCount = new Uint32Array(data.slice(offset, offset + 4).buffer)[0];
      offset += 4;

      const hasAuthTag = (encodedChunksCount & AUTH_TAG_FLAG) !== 0;
      totalChunks = hasAuthTag ? encodedChunksCount & ~AUTH_TAG_FLAG : encodedChunksCount;

      if (hasAuthTag) {
        const authTag = data.slice(offset, offset + AUTH_TAG_SIZE);
        offset += AUTH_TAG_SIZE;
        const expectedAuthTag = await deriveAuthTag(password, salt);
        if (authTag.length !== expectedAuthTag.length) {
          throw new Error("인증 태그가 손상되었습니다.");
        }
        for (let i = 0; i < authTag.length; i++) {
          if (authTag[i] !== expectedAuthTag[i]) {
            throw new Error("암호화 비밀번호가 올바르지 않습니다.");
          }
        }
      }

      key = await deriveKey(password, salt, "AES-CTR");

    } else {
      // ===== V1 AES-GCM 포맷 (기존) =====
      salt = data.slice(0, 16);
      const iv = data.slice(16, 28);
      const encryptedData = data.slice(28);

      const keyMaterial = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(password),
        { name: "PBKDF2" },
        false,
        ["deriveKey"]
      );
      key = await crypto.subtle.deriveKey(
        { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        false,
        ["decrypt"]
      );

      const decryptedData = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        key,
        encryptedData
      );

      return {
        success: true,
        decryptedFile: new File(
          [decryptedData],
          originalMetadata.originalName,
          { type: originalMetadata.originalType }
        ),
      };
    }

    // V1/V2 공통: 스트리밍 복호화
    const stream = new ReadableStream({
      async start(controller) {
        try {
          let remainingData = data.slice(offset);

          for (let i = 0; i < totalChunks; i++) {
            const chunkCounter = computeChunkCounter(counter, i);
            const chunkSize = Math.min(CHUNK_SIZE, remainingData.length);
            const encryptedChunk = remainingData.slice(0, chunkSize);
            remainingData = remainingData.slice(chunkSize);

            const decryptedChunk = await crypto.subtle.decrypt(
              { name: "AES-CTR", counter: chunkCounter, length: 64 },
              key,
              encryptedChunk
            );

            controller.enqueue(new Uint8Array(decryptedChunk));
          }
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });

    const decryptedData = await new Response(stream).arrayBuffer();

    return {
      success: true,
      decryptedFile: new File(
        [decryptedData],
        originalMetadata.originalName,
        { type: originalMetadata.originalType }
      ),
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
  if (!mimetype) return false;
  const mediaTypes = ["image/", "video/", "audio/", "application/pdf", "text/plain"];
  return mediaTypes.some((type) => mimetype.startsWith(type));
}

// 암호화된 미디어 파일 미리보기용 복호화
export async function decryptForPreview(encryptedArrayBuffer, password, metadata = {}) {
  try {
    const result = await decryptFile(encryptedArrayBuffer, password, {
      originalName: metadata.originalName || "preview",
      originalType: metadata.originalMimetype || "application/octet-stream",
    });

    if (result.success) {
      return { success: true, blob: result.decryptedFile };
    }
    return { success: false, error: result.error || "복호화 실패" };
  } catch (error) {
    console.error("미리보기 복호화 오류:", error);
    return { success: false, error: error.message || "복호화 중 오류가 발생했습니다." };
  }
}

// 파일 다운로드용 복호화
export async function downloadAndDecrypt(url, password, metadata) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("파일 다운로드 실패");

    const encryptedArrayBuffer = await response.arrayBuffer();
    const result = await decryptFile(encryptedArrayBuffer, password, metadata);

    if (result.success) {
      const downloadUrl = URL.createObjectURL(result.decryptedFile);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = metadata.originalName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);
      return { success: true };
    }
    return result;
  } catch (error) {
    console.error("다운로드 및 복호화 오류:", error);
    return { success: false, error: "파일 다운로드 및 복호화 중 오류가 발생했습니다." };
  }
}

// 비밀번호 강도 검증
export function validatePasswordStrength(password) {
  const result = { isValid: true, errors: [] };

  if (!password || password.length < 12) {
    result.isValid = false;
    result.errors.push("비밀번호는 최소 12자 이상이어야 합니다.");
  }

  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
  const complexityCount = [hasUpperCase, hasLowerCase, hasNumber, hasSpecialChar].filter(Boolean).length;

  if (complexityCount < 2) {
    result.isValid = false;
    result.errors.push("비밀번호는 최소 2종 이상의 문자(대소문자/숫자/특수문자)를 포함해야 합니다.");
  }

  const commonPasswords = [
    'password', 'password123', '123456789012', 'qwerty123456',
    'password!', 'Password123', 'PASSWORD123'
  ];
  if (commonPasswords.some(p => password.toLowerCase().includes(p.toLowerCase()))) {
    result.isValid = false;
    result.errors.push("비밀번호가 너무 흔합니다. 더 복잡한 비밀번호를 사용해주세요.");
  }

  return result;
}

// 내보내기: 기존 deriveKeyFromPassword 호환성 유지
export async function deriveKeyFromPassword(password, salt, algorithm = "AES-CTR", useScrypt = false) {
  return deriveKey(password, salt, algorithm, useScrypt);
}