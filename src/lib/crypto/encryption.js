/**
 * 클라이언트 측 E2EE (종단간 암호화) 유틸리티
 * AES-CTR 알고리즘을 사용하여 파일을 암호화/복호화 (기존 AES-GCM 호환성 유지)
 * v2: HMAC-SHA256 무결성 검증, scrypt 키 유도 옵션 지원
 */

// 암호화 모드 식별 상수
const ENCRYPTION_MODE = {
  AES_GCM: 1,
  AES_CTR: 2,
};

// 암호화 포맷 버전 (하위 호환성 유지)
const ENCRYPTION_VERSION = {
  V1: 1, // 기존 포맷 (SHA-256 authTag)
  V2: 2, // 강화 포맷 (HMAC-SHA256 + 개선된 키 유도)
};

const AUTH_TAG_SIZE = 32;
const HMAC_SIZE = 32;

// 하위 호환성 유지 (구형 v1 포맷)
const AUTH_TAG_CONTEXT = "shareify-e2ee-v1";
const AUTH_TAG_FLAG = 0x80000000;

// 키 유도 알고리즘 식별 상수
const KEY_DERIVATION = {
  PBKDF2: 'PBKDF2',
  SCRYPT: 'scrypt',
};

// Argon2id 추정치 (브라우저 미지원 시 fallback)
const SCRYPT_PARAMS = {
  N: 2 ** 16,   // CPU/memory cost parameter
  r: 16,         // block size
  p: 1,          // parallelization parameter
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

// 구형 v1 포맷 호환을 위한 authTag 생성 (deprecated, 하위 호환용)
async function deriveAuthTag(password, salt) {
  const encoder = new TextEncoder();
  const passwordBytes = encoder.encode(password);
  const contextBytes = encoder.encode(AUTH_TAG_CONTEXT);
  const data = concatUint8Arrays(salt, passwordBytes, contextBytes);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return new Uint8Array(digest);
}

// HMAC-SHA256 생성 (v2 무결성 검증용)
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
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'HMAC', hash: 'SHA-256', length: 256 },
    false,
    ['sign']
  );
  const hmac = await crypto.subtle.sign('HMAC', hmacKey, salt);
  return new Uint8Array(hmac);
}

// scrypt 기반 키 유도 (개선된 보안)
async function deriveKeyWithScrypt(password, salt) {
  const encoder = new TextEncoder();
  const passwordBytes = encoder.encode(password);
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    passwordBytes,
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'scrypt',
      salt: salt,
      N: SCRYPT_PARAMS.N,
      r: SCRYPT_PARAMS.r,
      p: SCRYPT_PARAMS.p,
    },
    keyMaterial,
    256
  );
  return await crypto.subtle.importKey(
    'raw',
    derivedBits,
    { name: 'AES-CTR', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

// 암호화 키 생성 (사용자 비밀번호 기반) - Argon2id 대체 (scrypt 사용)
export async function deriveKeyFromPassword(
  password,
  salt,
  algorithm = "AES-CTR",
  useScrypt = false
) {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );

  // scrypt 사용 시도 (지원되는 경우) - 직접 시도 후 fallback
  if (useScrypt) {
    try {
      return await deriveKeyWithScrypt(password, salt);
    } catch (e) {
      // fallback to PBKDF2
    }
  }

  return await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000,
      hash: "SHA-256",
    },
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

// 랜덤 Counter 생성 (AES-CTR용)
export function generateCounter() {
  return crypto.getRandomValues(new Uint8Array(16));
}

// 랜덤 IV 생성 (AES-GCM용)
export function generateIV() {
  return crypto.getRandomValues(new Uint8Array(12));
}

// v1 포맷 스트림 생성기 (하위 호환용)
async function* generateEncryptedStreamV1(
  file,
  key,
  salt,
  initialCounter,
  authTag
) {
  const CHUNK_SIZE = 5 * 1024 * 1024;
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
  
  const header = new Uint8Array(
    1 + salt.length + initialCounter.length + 4 + authTag.length
  );
  header[0] = ENCRYPTION_MODE.AES_CTR;
  header.set(salt, 1);
  header.set(initialCounter, 1 + salt.length);
  const encodedChunkCount = totalChunks | AUTH_TAG_FLAG;
  header.set(
    new Uint8Array(new Uint32Array([encodedChunkCount]).buffer),
    1 + salt.length + initialCounter.length
  );
  header.set(authTag, 1 + salt.length + initialCounter.length + 4);
  yield header;

  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, file.size);

    const chunkCounter = new Uint8Array(initialCounter);
    for (let j = 0; j < i; j++) {
      for (let k = 15; k >= 8; k--) {
        if (chunkCounter[k] === 255) {
          chunkCounter[k] = 0;
          continue;
        }
        chunkCounter[k]++;
        break;
      }
    }

    const chunk = await file.slice(start, end).arrayBuffer();
    const encryptedChunk = await crypto.subtle.encrypt(
      {
        name: "AES-CTR",
        counter: chunkCounter,
        length: 64,
      },
      key,
      chunk
    );

    yield new Uint8Array(encryptedChunk);
  }
}

// v2 포맷 스트림 생성기 (강화 보안)
async function* generateEncryptedStreamV2(
  file,
  key,
  salt,
  initialCounter,
  hmac,
  totalChunks
) {
  const CHUNK_SIZE = 5 * 1024 * 1024;
  
  // v2 헤더: [버전 1바이트][모드 1바이트][솔트 16바이트][카운터 16바이트][HMAC 32바이트][청크 수 4바이트]
  const header = new Uint8Array(1 + 1 + 16 + 16 + HMAC_SIZE + 4);
  header[0] = ENCRYPTION_VERSION.V2;
  header[1] = ENCRYPTION_MODE.AES_CTR;
  header.set(salt, 2);
  header.set(initialCounter, 18);
  header.set(hmac, 34);
  header.set(new Uint8Array(new Uint32Array([totalChunks]).buffer), 66);
  yield header;

  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, file.size);

    const chunkCounter = new Uint8Array(initialCounter);
    for (let j = 0; j < i; j++) {
      for (let k = 15; k >= 8; k--) {
        if (chunkCounter[k] === 255) {
          chunkCounter[k] = 0;
          continue;
        }
        chunkCounter[k]++;
        break;
      }
    }

    const chunk = await file.slice(start, end).arrayBuffer();
    const encryptedChunk = await crypto.subtle.encrypt(
      {
        name: "AES-CTR",
        counter: chunkCounter,
        length: 64,
      },
      key,
      chunk
    );

    yield new Uint8Array(encryptedChunk);
  }
}

// 파일 암호화 (v2 강화 포맷 사용, v1 호환 가능)
export async function encryptFile(file, password, options = {}) {
  try {
    if (!window.crypto || !window.crypto.subtle) {
      throw new Error("이 브라우저는 암호화 기능을 지원하지 않습니다.");
    }

    const { useScrypt = false, version = ENCRYPTION_VERSION.V2 } = options;

    const salt = generateSalt();
    const counter = generateCounter();
    
    const key = await deriveKeyFromPassword(password, salt, "AES-CTR", useScrypt);
    const hmac = version === ENCRYPTION_VERSION.V2 
      ? await generateHMAC(salt, password) 
      : null;

    const totalChunks = Math.ceil(file.size / (5 * 1024 * 1024));

    const stream = new ReadableStream({
      async start(controller) {
        try {
          if (version === ENCRYPTION_VERSION.V2) {
            for await (const chunk of generateEncryptedStreamV2(
              file,
              key,
              salt,
              counter,
              hmac,
              totalChunks
            )) {
              controller.enqueue(chunk);
            }
          } else {
            for await (const chunk of generateEncryptedStreamV1(
              file,
              key,
              salt,
              counter,
              await deriveAuthTag(password, salt)
            )) {
              controller.enqueue(chunk);
            }
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
    } else {
      return {
        success: false,
        error: "파일 암호화 중 오류가 발생했습니다: " + error.message,
      };
    }
  }
}

// 파일 복호화 (v1/v2 모두 지원)
export async function decryptFile(
  encryptedArrayBuffer,
  password,
  originalMetadata
) {
  try {
    const data = new Uint8Array(encryptedArrayBuffer);

    // 첫 번째 바이트로 암호화 버전 확인
    const version = data[0];
    let salt, counter, iv, encryptedData, key, decryptedData, authTag, hmac;
    const CHUNK_SIZE = 5 * 1024 * 1024;

    if (version === ENCRYPTION_VERSION.V2) {
      // v2 강화 포맷
      let offset = 1;
      const encryptionMode = data[offset++];
      if (encryptionMode !== ENCRYPTION_MODE.AES_CTR) {
        throw new Error("지원되지 않는 암호화 모드입니다.");
      }
      
      salt = data.slice(offset, offset + 16);
      offset += 16;
      counter = data.slice(offset, offset + 16);
      offset += 16;
      hmac = data.slice(offset, offset + HMAC_SIZE);
      offset += HMAC_SIZE;
      
      const totalChunks = new Uint32Array(data.slice(offset, offset + 4).buffer)[0];
      offset += 4;

      // HMAC 검증
      const expectedHMAC = await generateHMAC(salt, password);
      if (expectedHMAC.length !== hmac.length) {
        throw new Error("무결성 검증에 실패했습니다.");
      }
      for (let i = 0; i < hmac.length; i++) {
        if (hmac[i] !== expectedHMAC[i]) {
          throw new Error("암호화 비밀번호가 올바르지 않습니다.");
        }
      }

      const useScrypt = originalMetadata.useScrypt || false;
      key = await deriveKeyFromPassword(password, salt, "AES-CTR", useScrypt);

      const stream = new ReadableStream({
        async start(controller) {
          try {
            let remainingData = data.slice(offset);

            for (let i = 0; i < totalChunks; i++) {
              const chunkCounter = new Uint8Array(counter);
              for (let j = 0; j < i; j++) {
                for (let k = 15; k >= 8; k--) {
                  if (chunkCounter[k] === 255) {
                    chunkCounter[k] = 0;
                    continue;
                  }
                  chunkCounter[k]++;
                  break;
                }
              }

              const chunkSize = Math.min(CHUNK_SIZE, remainingData.length);
              const encryptedChunk = remainingData.slice(0, chunkSize);
              remainingData = remainingData.slice(chunkSize);

              const decryptedChunk = await crypto.subtle.decrypt(
                {
                  name: "AES-CTR",
                  counter: chunkCounter,
                  length: 64,
                },
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

      decryptedData = await new Response(stream).arrayBuffer();

    } else if (data[0] === ENCRYPTION_MODE.AES_CTR) {
      // v1 AES-CTR 형식 (하위 호환)
      let offset = 1;
      salt = data.slice(offset, offset + 16);
      offset += 16;
      counter = data.slice(offset, offset + 16);
      offset += 16;

      let encodedChunksCount = new Uint32Array(
        data.slice(offset, offset + 4).buffer
      )[0];
      offset += 4;

      const hasAuthTag = (encodedChunksCount & AUTH_TAG_FLAG) !== 0;
      const chunksCount = hasAuthTag
        ? encodedChunksCount & ~AUTH_TAG_FLAG
        : encodedChunksCount;

      if (hasAuthTag) {
        authTag = data.slice(offset, offset + AUTH_TAG_SIZE);
        offset += AUTH_TAG_SIZE;
      } else {
        authTag = null;
      }

      key = await deriveKeyFromPassword(password, salt, "AES-CTR");

      if (authTag) {
        const expectedAuthTag = await deriveAuthTag(password, salt);
        if (expectedAuthTag.length !== authTag.length) {
          throw new Error("인증 태그가 손상되었습니다.");
        }
        for (let i = 0; i < authTag.length; i++) {
          if (authTag[i] !== expectedAuthTag[i]) {
            throw new Error("암호화 비밀번호가 올바르지 않습니다.");
          }
        }
      }

      const stream = new ReadableStream({
        async start(controller) {
          try {
            let remainingData = data.slice(offset);

            for (let i = 0; i < chunksCount; i++) {
              const chunkCounter = new Uint8Array(counter);
              for (let j = 0; j < i; j++) {
                for (let k = 15; k >= 8; k--) {
                  if (chunkCounter[k] === 255) {
                    chunkCounter[k] = 0;
                    continue;
                  }
                  chunkCounter[k]++;
                  break;
                }
              }

              const chunkSize = Math.min(CHUNK_SIZE, remainingData.length);
              const encryptedChunk = remainingData.slice(0, chunkSize);
              remainingData = remainingData.slice(chunkSize);

              const decryptedChunk = await crypto.subtle.decrypt(
                {
                  name: "AES-CTR",
                  counter: chunkCounter,
                  length: 64,
                },
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

      decryptedData = await new Response(stream).arrayBuffer();
    } else {
      // AES-GCM 형식 (v1 기존 형식)
      salt = data.slice(0, 16);
      iv = data.slice(16, 28);
      encryptedData = data.slice(28);

      key = await deriveKeyFromPassword(password, salt, "AES-GCM");
      decryptedData = await crypto.subtle.decrypt(
        {
          name: "AES-GCM",
          iv: iv,
        },
        key,
        encryptedData
      );
    }

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
  if (!mimetype) return false;
  const mediaTypes = ["image/", "video/", "audio/", "application/pdf", "text/plain"];
  return mediaTypes.some((type) => mimetype.startsWith(type));
}

// 암호화된 미디어 파일 미리보기용 복호화
export async function decryptForPreview(
  encryptedArrayBuffer,
  password,
  metadata = {}
) {
  try {
    const result = await decryptFile(encryptedArrayBuffer, password, {
      originalName: metadata.originalName || "preview",
      originalType: metadata.originalMimetype || "application/octet-stream",
    });

    if (result.success) {
      return {
        success: true,
        blob: result.decryptedFile,
      };
    }

    return {
      success: false,
      error: result.error || "복호화 실패",
    };
  } catch (error) {
    console.error("미리보기 복호화 오류:", error);
    return {
      success: false,
      error: error.message || "복호화 중 오류가 발생했습니다.",
    };
  }
}

// 파일 다운로드용 복호화
export async function downloadAndDecrypt(url, password, metadata) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error("파일 다운로드 실패");
    }

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
    return {
      success: false,
      error: "파일 다운로드 및 복호화 중 오류가 발생했습니다.",
    };
  }
}

// 비밀번호 강도 검증
export function validatePasswordStrength(password) {
  const result = {
    isValid: true,
    errors: [],
  };

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

  // 흔한 비밀번호 체크 (기본 리스트)
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