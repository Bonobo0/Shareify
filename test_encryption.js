const { webcrypto } = require('crypto');
globalThis.crypto = webcrypto;

// ---- encryption.js 로직 추출 (64KB 서브청크 방식) ----
const CHUNK_SIZE = 5 * 1024 * 1024;
const SUB_CHUNK_SIZE = 64 * 1024;
const ENCRYPTION_MODE = { AES_GCM: 1, AES_CTR: 2 };
const V2_MAGIC = 0xFE;
const AUTH_TAG_SIZE = 32;
const HMAC_SIZE = 32;
const AUTH_TAG_FLAG = 0x80000000;

function getRandomBytes(size) {
  const buf = new Uint8Array(size);
  let off = 0;
  while (off < size) {
    const chunk = new Uint8Array(Math.min(65536, size - off));
    crypto.getRandomValues(chunk);
    buf.set(chunk, off);
    off += chunk.length;
  }
  return buf;
}

function computeCounter(initialCounter, gi) {
  const c = new Uint8Array(initialCounter);
  for (let j = 0; j < gi; j++) {
    for (let k = 15; k >= 8; k--) {
      if (c[k] === 255) { c[k] = 0; continue; }
      c[k]++; break;
    }
  }
  return c;
}

async function deriveKey(password, salt) {
  const km = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), { name: "PBKDF2" }, false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
    km, { name: "AES-CTR", length: 256 }, false, ["encrypt", "decrypt"]
  );
}

async function deriveAuthTag(password, salt) {
  const d = new Uint8Array([...salt, ...new TextEncoder().encode(password), ...new TextEncoder().encode("shareify-e2ee-v1")]);
  return new Uint8Array(await crypto.subtle.digest("SHA-256", d));
}

async function generateHMAC(salt, password) {
  const km = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), { name: 'PBKDF2' }, false, ['deriveKey']);
  const hk = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    km, { name: 'HMAC', hash: 'SHA-256', length: 256 }, false, ['sign']
  );
  return new Uint8Array(await crypto.subtle.sign('HMAC', hk, salt));
}

async function aesCtrEncrypt(pt, key, ctr) {
  const r = new Uint8Array(pt.length);
  let gi = 0, d = 0;
  while (d < pt.length) {
    const e = Math.min(d + SUB_CHUNK_SIZE, pt.length);
    const c = await crypto.subtle.encrypt(
      { name: "AES-CTR", counter: computeCounter(ctr, gi), length: 64 },
      key, pt.slice(d, e)
    );
    r.set(new Uint8Array(c), d);
    d = e; gi++;
  }
  return r;
}

async function aesCtrDecrypt(ct, key, ctr) {
  const r = new Uint8Array(ct.length);
  let gi = 0, d = 0;
  while (d < ct.length) {
    const e = Math.min(d + SUB_CHUNK_SIZE, ct.length);
    const c = await crypto.subtle.decrypt(
      { name: "AES-CTR", counter: computeCounter(ctr, gi), length: 64 },
      key, ct.slice(d, e)
    );
    r.set(new Uint8Array(c), d);
    d = e; gi++;
  }
  return r;
}

function genSalt() { return crypto.getRandomValues(new Uint8Array(16)); }
function genCounter() { return crypto.getRandomValues(new Uint8Array(16)); }

// ---- V2 ----
async function encryptV2(pt, pw) {
  const salt = genSalt(), counter = genCounter();
  const key = await deriveKey(pw, salt);
  const tc = Math.ceil(pt.length / CHUNK_SIZE);
  const hmac = await generateHMAC(salt, pw);
  const hdr = new Uint8Array(70);
  hdr[0] = V2_MAGIC; hdr[1] = ENCRYPTION_MODE.AES_CTR;
  hdr.set(salt, 2); hdr.set(counter, 18); hdr.set(hmac, 34);
  hdr.set(new Uint8Array(new Uint32Array([tc]).buffer), 66);

  const chunks = [];
  for (let i = 0; i < tc; i++) {
    chunks.push(await aesCtrEncrypt(pt.slice(i * CHUNK_SIZE, Math.min((i + 1) * CHUNK_SIZE, pt.length)), key, counter));
  }
  const tl = hdr.length + chunks.reduce((s, c) => s + c.length, 0);
  const r = new Uint8Array(tl);
  r.set(hdr); let o = hdr.length;
  for (const c of chunks) { r.set(c, o); o += c.length; }
  return r;
}

async function decryptV2(enc, pw) {
  const d = new Uint8Array(enc);
  if (d[0] !== V2_MAGIC) throw new Error("bad magic");
  let o = 1;
  if (d[o++] !== ENCRYPTION_MODE.AES_CTR) throw new Error("bad mode");
  const salt = d.slice(o, o + 16); o += 16;
  const counter = d.slice(o, o + 16); o += 16;
  const hmac = d.slice(o, o + HMAC_SIZE); o += HMAC_SIZE;
  const exp = await generateHMAC(salt, pw);
  for (let i = 0; i < hmac.length; i++) if (hmac[i] !== exp[i]) throw new Error("HMAC fail");
  const tc = new Uint32Array(d.slice(o, o + 4).buffer)[0]; o += 4;
  const key = await deriveKey(pw, salt);
  const chunks = [];
  let p = o;
  for (let i = 0; i < tc; i++) {
    const e = Math.min(p + CHUNK_SIZE, d.length);
    chunks.push(await aesCtrDecrypt(d.slice(p, e), key, counter));
    p = e;
  }
  const tl = chunks.reduce((s, c) => s + c.length, 0);
  const r = new Uint8Array(tl); let o2 = 0;
  for (const c of chunks) { r.set(c, o2); o2 += c.length; }
  return r;
}

// ---- V1 AES-CTR ----
async function encryptV1(pt, pw) {
  const salt = genSalt(), counter = genCounter();
  const key = await deriveKey(pw, salt);
  const tc = Math.ceil(pt.length / CHUNK_SIZE);
  const at = await deriveAuthTag(pw, salt);
  const hdr = new Uint8Array(69);
  hdr[0] = ENCRYPTION_MODE.AES_CTR;
  hdr.set(salt, 1); hdr.set(counter, 17);
  hdr.set(new Uint8Array(new Uint32Array([tc | AUTH_TAG_FLAG]).buffer), 33);
  hdr.set(at, 37);

  const chunks = [];
  for (let i = 0; i < tc; i++) {
    chunks.push(await aesCtrEncrypt(pt.slice(i * CHUNK_SIZE, Math.min((i + 1) * CHUNK_SIZE, pt.length)), key, counter));
  }
  const tl = hdr.length + chunks.reduce((s, c) => s + c.length, 0);
  const r = new Uint8Array(tl);
  r.set(hdr); let o = hdr.length;
  for (const c of chunks) { r.set(c, o); o += c.length; }
  return r;
}

async function decryptV1(enc, pw) {
  const d = new Uint8Array(enc);
  if (d[0] !== ENCRYPTION_MODE.AES_CTR) throw new Error("not V1");
  let o = 1;
  const salt = d.slice(o, o + 16); o += 16;
  const counter = d.slice(o, o + 16); o += 16;
  const ec = new Uint32Array(d.slice(o, o + 4).buffer)[0]; o += 4;
  const tc = ec & ~AUTH_TAG_FLAG;
  const at = d.slice(o, o + AUTH_TAG_SIZE); o += AUTH_TAG_SIZE;
  const exp = await deriveAuthTag(pw, salt);
  for (let i = 0; i < at.length; i++) if (at[i] !== exp[i]) throw new Error("authTag fail");
  const key = await deriveKey(pw, salt);
  const chunks = [];
  let p = o;
  for (let i = 0; i < tc; i++) {
    chunks.push(await aesCtrDecrypt(d.slice(p, Math.min(p + CHUNK_SIZE, d.length)), key, counter));
    p = Math.min(p + CHUNK_SIZE, d.length);
  }
  const tl = chunks.reduce((s, c) => s + c.length, 0);
  const r = new Uint8Array(tl); let o2 = 0;
  for (const c of chunks) { r.set(c, o2); o2 += c.length; }
  return r;
}

// ============================================================
let passed = 0, failed = 0;
function ok(cond, msg) {
  if (cond) { console.log("  PASS " + msg); passed++; }
  else { console.log("  FAIL " + msg); failed++; }
}
function eq(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

async function main() {
  const pw = "MyStr0ng!Pass";

  console.log("[T1] V2 소량 (5B) 라운드트립");
  try {
    const d = new Uint8Array([72, 101, 108, 108, 111]);
    const e = await encryptV2(d, pw);
    ok(e[0] === 0xFE, "magic=0xFE");
    ok(e[1] === 2, "mode=2");
    ok(eq(d, await decryptV2(e, pw)), "데이터 일치");
  } catch (ex) { ok(false, ex.message); }

  console.log("\n[T2] V2 대용량 (3MB, 64KB 서브청크 방식)");
  try {
    const big = getRandomBytes(3 * 1024 * 1024);
    const t0 = Date.now();
    const e = await encryptV2(big, pw);
    const t1 = Date.now();
    const dec = await decryptV2(e, pw);
    const t2 = Date.now();
    ok(eq(big, dec), "3MB OK (enc:" + (t1-t0) + "ms dec:" + (t2-t1) + "ms)");
  } catch (ex) { ok(false, ex.message); }

  console.log("\n[T3] V1 소량 라운드트립");
  try {
    const d = new Uint8Array([72, 101, 108, 108, 111]);
    ok((await encryptV1(d, pw))[0] === 2, "V1 magic=2");
    ok(eq(d, await decryptV1(await encryptV1(d, pw), pw)), "V1 데이터 일치");
  } catch (ex) { ok(false, ex.message); }

  console.log("\n[T4] V1(0x02) != V2(0xFE) 충돌없음");
  try {
    const d = new Uint8Array([1, 2, 3]);
    const v1 = await encryptV1(d, pw);
    const v2 = await encryptV2(d, pw);
    ok(v1[0] === 2 && v2[0] === 0xFE && v1[0] !== v2[0], "서로 다른 매직 바이트");
  } catch (ex) { ok(false, ex.message); }

  console.log("\n[T5] V2 잘못된 비밀번호");
  try {
    const d = new Uint8Array([65, 66, 67]);
    const e = await encryptV2(d, pw);
    let rej = false;
    try { await decryptV2(e, "wrongpw1234!"); } catch (ex) { rej = true; }
    ok(rej, "잘못된 비밀번호 거부");
  } catch (ex) { ok(false, ex.message); }

  console.log("\n" + "=".repeat(40));
  console.log("결과: " + passed + " passed, " + failed + " failed");
  console.log("=".repeat(40));
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => { console.error(e.message, e.stack); process.exit(1); });
