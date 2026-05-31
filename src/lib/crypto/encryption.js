/**
 * 클라이언트 측 E2EE (종단간 암호화) 유틸리티
 *
 * 포맷 구조:
 * V1 AES-GCM: [mode: 1B=0x01][salt: 16B][iv: 12B][encrypted data...]
 * V1 AES-CTR: [mode: 1B=0x02][salt: 16B][counter: 16B][chunkCount|FLAG: 4B][authTag: 32B][encrypted chunks...]
 * V2 (강화):   [0xFE: 1B][mode: 1B][salt: 16B][counter: 16B][HMAC: 32B][chunkCount: 4B][encrypted chunks...]
 *
 * 주의: V2 매직 바이트는 V1 모드 값(0x01, 0x02)과 겹치지 않는 0xFE 사용
 * 64KB 서브청크로 쪼개서 암호화 (Node.js crypto.subtle.encrypt 64KB 제한 대응)
 */

const ENCRYPTION_MODE = { AES_GCM: 1, AES_CTR: 2 };
const V2_MAGIC = 0xFE;
const AUTH_TAG_SIZE = 32;
const HMAC_SIZE = 32;
const AUTH_TAG_CONTEXT = "shareify-e2ee-v1";
const AUTH_TAG_FLAG = 0x80000000;
const CHUNK_SIZE = 5 * 1024 * 1024;
const SUB_CHUNK_SIZE = 64 * 1024; // Node.js 64KB 제한 대응

// ---- 유틸리티 ----

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

/**
 * 글로벌 서브청크 인덱스로 카운터 계산
 * globalIndex 0 = initialCounter 그대로
 * globalIndex N = initialCounter + N (하위 8바이트 카운터 부분만 증가)
 */
function computeCounter(initialCounter, globalIndex) {
  const counter = new Uint8Array(initialCounter);
  for (let j = 0; j < globalIndex; j++) {
    for (let k = 15; k >= 8; k--) {
      if (counter[k] === 255) { counter[k] = 0; continue; }
      counter[k]++;
      break;
    }
  }
  return counter;
}

// ---- 키 유도 & 인증 ----

async function deriveAuthTag(password, salt) {
  const encoder = new TextEncoder();
  const data = concatUint8Arrays(salt, encoder.encode(password), encoder.encode(AUTH_TAG_CONTEXT));
  return new Uint8Array(await crypto.subtle.digest("SHA-256", data));
}

async function generateHMAC(salt, password) {
  const passwordBytes = new TextEncoder().encode(password);
  const keyMaterial = await crypto.subtle.importKey(
    'raw', passwordBytes, { name: 'PBKDF2' }, false, ['deriveKey']
  );
  const hmacKey = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'HMAC', hash: 'SHA-256', length: 256 }, false, ['sign']
  );
  return new Uint8Array(await crypto.subtle.sign('HMAC', hmacKey, salt));
}

async function deriveKey(password, salt, algorithm = "AES-CTR", useScrypt = false) {
  const encoder = new TextEncoder();
  const pwBytes = encoder.encode(password);

  if (useScrypt) {
    try {
      const km = await crypto.subtle.importKey("raw", pwBytes, { name: "PBKDF2" }, false, ["deriveBits"]);
      const bits = await crypto.subtle.deriveBits(
        { name: "scrypt", salt, N: 2 ** 16, r: 16, p: 1 }, km, 256
      );
      return await crypto.subtle.importKey("raw", bits, { name: "AES-CTR", length: 256 }, false, ["encrypt", "decrypt"]);
    } catch (e) { /* fallback to PBKDF2 */ }
  }

  const km = await crypto.subtle.importKey("raw", pwBytes, { name: "PBKDF2" }, false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
    km, { name: algorithm, length: 256 }, false, ["encrypt", "decrypt"]
  );
}

export function generateSalt() { return crypto.getRandomValues(new Uint8Array(16)); }
export function generateCounter() { return crypto.getRandomValues(new Uint8Array(16)); }
export function generateIV() { return crypto.getRandomValues(new Uint8Array(12)); }

// ---- 핵심: 64KB 서브청크 AES-CTR 암호화/복호화 ----

/**
 * Uint8Array를 AES-CTR로 암호화 (내부적으로 64KB 서브청크로 쪼개서 처리)
 * @param {Uint8Array} plaintext
 * @param {CryptoKey} key
 * @param {Uint8Array} initialCounter - 16바이트 카운터
 * @returns {Uint8Array} 암호화된 데이터
 */
async function aesCtrEncrypt(plaintext, key, initialCounter) {
  const totalLen = plaintext.length;
  const result = new Uint8Array(totalLen); // CTR 모드에서 길이 동일
  let subChunkGlobalIndex = 0;
  let done = 0;

  while (done < totalLen) {
    const subEnd = Math.min(done + SUB_CHUNK_SIZE, totalLen);
    const subChunk = plaintext.slice(done, subEnd);
    const ctr = computeCounter(initialCounter, subChunkGlobalIndex);

    const encrypted = await crypto.subtle.encrypt(
      { name: "AES-CTR", counter: ctr, length: 64 }, key, subChunk
    );

    result.set(new Uint8Array(encrypted), done);
    done = subEnd;
    subChunkGlobalIndex++;
  }

  return result;
}

/**
 * Uint8Array를 AES-CTR로 복호화 (64KB 서브청크)
 */
async function aesCtrDecrypt(ciphertext, key, initialCounter) {
  const totalLen = ciphertext.length;
  const result = new Uint8Array(totalLen);
  let subChunkGlobalIndex = 0;
  let done = 0;

  while (done < totalLen) {
    const subEnd = Math.min(done + SUB_CHUNK_SIZE, totalLen);
    const subChunk = ciphertext.slice(done, subEnd);
    const ctr = computeCounter(initialCounter, subChunkGlobalIndex);

    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-CTR", counter: ctr, length: 64 }, key, subChunk
    );

    result.set(new Uint8Array(decrypted), done);
    done = subEnd;
    subChunkGlobalIndex++;
  }

  return result;
}

// ---- 파일 암호화 ----

export async function encryptFile(file, password, options = {}) {
  try {
    if (!window.crypto || !window.crypto.subtle) {
      throw new Error("이 브라우저는 암호화 기능을 지원하지 않습니다.");
    }

    const useScrypt = options.useScrypt || false;
    const version = options.version || 2;
    const isV2 = (version === 2);

    const salt = generateSalt();
    const counter = generateCounter();
    const key = await deriveKey(password, salt, "AES-CTR", useScrypt);
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

    // ---- 헤더 생성 ----
    let header;
    if (isV2) {
      const hmac = await generateHMAC(salt, password);
      // [0xFE][mode][salt][counter][HMAC][chunkCount] = 70 bytes
      header = new Uint8Array(70);
      header[0] = V2_MAGIC;
      header[1] = ENCRYPTION_MODE.AES_CTR;
      header.set(salt, 2);
      header.set(counter, 18);
      header.set(hmac, 34);
      header.set(new Uint8Array(new Uint32Array([totalChunks]).buffer), 66);
    } else {
      const authTag = await deriveAuthTag(password, salt);
      // [mode][salt][counter][chunkCount|FLAG][authTag] = 69 bytes
      header = new Uint8Array(69);
      header[0] = ENCRYPTION_MODE.AES_CTR;
      header.set(salt, 1);
      header.set(counter, 17);
      header.set(new Uint8Array(new Uint32Array([totalChunks | AUTH_TAG_FLAG]).buffer), 33);
      header.set(authTag, 37);
    }

    // ---- 청크 암호화 ----
    const stream = new ReadableStream({
      async start(controller) {
        try {
          controller.enqueue(header);

          for (let i = 0; i < totalChunks; i++) {
            const start = i * CHUNK_SIZE;
            const end = Math.min(start + CHUNK_SIZE, file.size);
            const chunkData = new Uint8Array(await file.slice(start, end).arrayBuffer());

            // 핵심: 서브청크 단위 AES-CTR 암호화
            const encryptedChunk = await aesCtrEncrypt(chunkData, key, counter);
            controller.enqueue(encryptedChunk);
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
    return { success: false, error: "파일 암호화 중 오류가 발생했습니다: " + error.message };
  }
}

// ---- 파일 복호화 ----

export async function decryptFile(encryptedArrayBuffer, password, originalMetadata) {
  try {
    const data = new Uint8Array(encryptedArrayBuffer);
    const firstByte = data[0];

    let salt, counter, key, totalChunks, headerSize;

    if (firstByte === V2_MAGIC) {
      // ===== V2 포맷 =====
      let off = 1;
      if (data[off++] !== ENCRYPTION_MODE.AES_CTR) throw new Error("지원되지 않는 암호화 모드");

      salt = data.slice(off, off + 16); off += 16;
      counter = data.slice(off, off + 16); off += 16;

      // HMAC 검증
      const hmac = data.slice(off, off + HMAC_SIZE); off += HMAC_SIZE;
      const expectedHMAC = await generateHMAC(salt, password);
      if (hmac.length !== expectedHMAC.length) throw new Error("무결성 검증 실패");
      for (let i = 0; i < hmac.length; i++) {
        if (hmac[i] !== expectedHMAC[i]) throw new Error("비밀번호가 올바르지 않습니다");
      }

      totalChunks = new Uint32Array(data.slice(off, off + 4).buffer)[0];
      off += 4;
      headerSize = off;

      const useScrypt = originalMetadata.useScrypt || false;
      key = await deriveKey(password, salt, "AES-CTR", useScrypt);

    } else if (firstByte === ENCRYPTION_MODE.AES_CTR) {
      // ===== V1 AES-CTR 포맷 =====
      let off = 1;
      salt = data.slice(off, off + 16); off += 16;
      counter = data.slice(off, off + 16); off += 16;

      const encodedCount = new Uint32Array(data.slice(off, off + 4).buffer)[0];
      off += 4;

      const hasAuthTag = (encodedCount & AUTH_TAG_FLAG) !== 0;
      totalChunks = hasAuthTag ? encodedCount & ~AUTH_TAG_FLAG : encodedCount;

      if (hasAuthTag) {
        const authTag = data.slice(off, off + AUTH_TAG_SIZE); off += AUTH_TAG_SIZE;
        const expected = await deriveAuthTag(password, salt);
        for (let i = 0; i < authTag.length; i++) {
          if (authTag[i] !== expected[i]) throw new Error("비밀번호가 올바르지 않습니다");
        }
      }
      headerSize = off;
      key = await deriveKey(password, salt, "AES-CTR");

    } else {
      // ===== V1 AES-GCM 포맷 =====
      salt = data.slice(0, 16);
      const iv = data.slice(16, 28);
      const encData = data.slice(28);

      const km = await crypto.subtle.importKey(
        "raw", new TextEncoder().encode(password), { name: "PBKDF2" }, false, ["deriveKey"]
      );
      key = await crypto.subtle.deriveKey(
        { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
        km, { name: "AES-GCM", length: 256 }, false, ["decrypt"]
      );

      const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, encData);
      return {
        success: true,
        decryptedFile: new File([pt], originalMetadata.originalName, { type: originalMetadata.originalType }),
      };
    }

    // ===== V1/V2 공통: 스트리밍 복호화 =====
    const stream = new ReadableStream({
      async start(controller) {
        try {
          let pos = headerSize;
          for (let i = 0; i < totalChunks; i++) {
            const end = Math.min(pos + CHUNK_SIZE, data.length);
            const encChunk = data.slice(pos, end);
            const decChunk = await aesCtrDecrypt(encChunk, key, counter);
            controller.enqueue(decChunk);
            pos = end;
          }
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });

    const pt = await new Response(stream).arrayBuffer();
    return {
      success: true,
      decryptedFile: new File([pt], originalMetadata.originalName, { type: originalMetadata.originalType }),
    };
  } catch (error) {
    console.error("파일 복호화 오류:", error);
    return { success: false, error: "복호화에 실패했습니다. 비밀번호를 확인해주세요." };
  }
}

// ---- 기타 유틸리티 ----

export function isMediaFile(mimetype) {
  if (!mimetype) return false;
  return ["image/", "video/", "audio/", "application/pdf", "text/plain"].some(t => mimetype.startsWith(t));
}

export async function decryptForPreview(encryptedArrayBuffer, password, metadata = {}) {
  try {
    const result = await decryptFile(encryptedArrayBuffer, password, {
      originalName: metadata.originalName || "preview",
      originalType: metadata.originalMimetype || "application/octet-stream",
    });
    return result.success ? { success: true, blob: result.decryptedFile } : { success: false, error: result.error };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function downloadAndDecrypt(url, password, metadata) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("다운로드 실패");
    const encBuf = await response.arrayBuffer();
    const result = await decryptFile(encBuf, password, metadata);
    if (result.success) {
      const dlUrl = URL.createObjectURL(result.decryptedFile);
      const a = document.createElement("a");
      a.href = dlUrl;
      a.download = metadata.originalName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(dlUrl);
    }
    return result;
  } catch (error) {
    return { success: false, error: "다운로드 및 복호화 중 오류: " + error.message };
  }
}

export function validatePasswordStrength(password) {
  const result = { isValid: true, errors: [] };
  if (!password || password.length < 12) {
    result.isValid = false;
    result.errors.push("비밀번호는 최소 12자 이상이어야 합니다.");
  }
  const types = [/[A-Z]/, /[a-z]/, /[0-9]/, /[!@#$%^&*(),.?":{}|<>]/].filter(r => r.test(password)).length;
  if (types < 2) {
    result.isValid = false;
    result.errors.push("2종 이상의 문자(대소문자/숫자/특수문자)를 포함해야 합니다.");
  }
  return result;
}

// 호환성 유지
export async function deriveKeyFromPassword(password, salt, algorithm = "AES-CTR", useScrypt = false) {
  return deriveKey(password, salt, algorithm, useScrypt);
}