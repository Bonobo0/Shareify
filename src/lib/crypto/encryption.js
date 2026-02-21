/**
 * 클라이언트 측 E2EE (종단간 암호화) 유틸리티
 * AES-CTR 알고리즘을 사용하여 파일을 암호화/복호화 (기존 AES-GCM 호환성 유지)
 */

// 암호화 모드 식별 상수
const ENCRYPTION_MODE = {
  AES_GCM: 1,
  AES_CTR: 2,
};

const AUTH_TAG_SIZE = 32;
const AUTH_TAG_CONTEXT = "shareify-e2ee-v1";
const AUTH_TAG_FLAG = 0x80000000;

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

async function deriveAuthTag(password, salt) {
  const encoder = new TextEncoder();
  const passwordBytes = encoder.encode(password);
  const contextBytes = encoder.encode(AUTH_TAG_CONTEXT);
  const data = concatUint8Arrays(salt, passwordBytes, contextBytes);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return new Uint8Array(digest);
}

// 암호화 키 생성 (사용자 비밀번호 기반)
export async function deriveKeyFromPassword(
  password,
  salt,
  algorithm = "AES-CTR"
) {
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
  // AES-CTR을 위한 16바이트(128비트) 카운터 생성
  return crypto.getRandomValues(new Uint8Array(16));
}

// 랜덤 IV 생성 (AES-GCM용)
export function generateIV() {
  return crypto.getRandomValues(new Uint8Array(12));
}

// 스트림 생성기 함수
async function* generateEncryptedStream(
  file,
  key,
  salt,
  initialCounter,
  authTag
) {
  const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB 청크 크기로 줄임
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

  // 헤더 생성 및 반환 (모드 + salt + counter + 청크 수 + auth tag)
  const authTagLength = authTag.length;
  const header = new Uint8Array(
    1 + salt.length + initialCounter.length + 4 + authTagLength
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

  let processedSize = 0;

  // 청크 단위로 스트리밍 처리
  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, file.size);

    // 현재 청크의 카운터 계산
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

    // 청크 읽기 및 암호화
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

    processedSize += chunk.byteLength;
    console.log(
      `청크 ${i + 1}/${totalChunks} 암호화 완료, 진행률: ${Math.round(
        (processedSize / file.size) * 100
      )}%`
    );

    yield new Uint8Array(encryptedChunk);
  }
}

// 파일 암호화
export async function encryptFile(file, password) {
  try {
    // Web Crypto API 지원 확인
    if (!window.crypto || !window.crypto.subtle) {
      throw new Error("이 브라우저는 암호화 기능을 지원하지 않습니다.");
    }

    console.log("암호화 시작:", file.name, "크기:", file.size);

    const salt = generateSalt();
    const counter = generateCounter();
    const key = await deriveKeyFromPassword(password, salt, "AES-CTR");
    const authTag = await deriveAuthTag(password, salt);

    // ReadableStream을 사용하여 스트리밍 방식으로 처리
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of generateEncryptedStream(
            file,
            key,
            salt,
            counter,
            authTag
          )) {
            controller.enqueue(chunk);
          }
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });

    // 스트림을 Blob으로 변환
    const encryptedFile = new File(
      [await new Response(stream).blob()],
      file.name + ".encrypted",
      { type: "application/octet-stream" }
    );

    console.log("암호화된 파일 생성 완료:", encryptedFile.size, "bytes");

    return {
      success: true,
      encryptedFile,
      metadata: {
        originalName: file.name,
        originalSize: file.size,
        originalType: file.type,
        encryptedSize: encryptedFile.size,
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

    // 첫 번째 바이트로 암호화 모드 확인 (새로운 형식인 경우)
    const encryptionMode = data[0];
    let salt, counter, iv, encryptedData, key, decryptedData, authTag;

    if (encryptionMode === ENCRYPTION_MODE.AES_CTR) {
      // AES-CTR 형식 (새로운 형식)
      let offset = 1;
      salt = data.slice(offset, offset + 16);
      offset += 16;
      counter = data.slice(offset, offset + 16);
      offset += 16;

      // 청크 수 읽기
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

      const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB 청크 크기
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

      // 스트림으로 복호화
      const stream = new ReadableStream({
        async start(controller) {
          try {
            let remainingData = data.slice(offset);
            let processedSize = 0;

            for (let i = 0; i < chunksCount; i++) {
              // 각 청크마다 카운터 계산
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

              // 각 청크의 크기 계산
              const chunkSize = Math.min(CHUNK_SIZE, remainingData.length);
              const encryptedChunk = remainingData.slice(0, chunkSize);
              remainingData = remainingData.slice(chunkSize);

              console.log(`청크 ${i + 1}/${chunksCount} 복호화 중...`);
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
              processedSize += chunkSize;
              console.log(
                `복호화 진행률: ${Math.round(
                  (processedSize / (data.length - offset)) * 100
                )}%`
              );
            }
            controller.close();
          } catch (error) {
            controller.error(error);
          }
        },
      });

      // 스트림을 ArrayBuffer로 변환
      decryptedData = await new Response(stream).arrayBuffer();
    } else {
      // AES-GCM 형식 (기존 형식)
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
  if (!mimetype) return false;
  const mediaTypes = ["image/", "video/", "audio/", "application/pdf", "text/plain"];
  return mediaTypes.some((type) => mimetype.startsWith(type));
}

// 암호화된 미디어 파일 미리보기용 복호화 (ArrayBuffer에서 직접 복호화)
export async function decryptForPreview(
  encryptedArrayBuffer,
  password,
  metadata = {}
) {
  try {
    // 복호화
    const result = await decryptFile(encryptedArrayBuffer, password, {
      originalName: metadata.originalName || "preview",
      originalType: metadata.originalMimetype || "application/octet-stream",
    });

    if (result.success) {
      return {
        success: true,
        blob: result.decryptedFile, // Blob 객체를 blob 속성으로 반환
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
