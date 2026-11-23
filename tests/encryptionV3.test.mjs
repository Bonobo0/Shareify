import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes, webcrypto } from "node:crypto";
import { decryptFile, encryptFile } from "../src/lib/crypto/encryption.js";

globalThis.window ??= globalThis;

const roundTrip = async (version) => {
  const original = randomBytes(5 * 1024 * 1024 + 200_000);
  const file = new File([original], "a.bin", { type: "application/octet-stream" });
  const enc = await encryptFile(file, "pw-test-1234", { version });
  assert.equal(enc.success, true);
  const buf = Buffer.from(await enc.encryptedFile.arrayBuffer());
  const dec = await decryptFile(buf, "pw-test-1234", enc.metadata);
  assert.equal(dec.success, true);
  assert.equal(Buffer.from(await dec.decryptedFile.arrayBuffer()).equals(original), true);
  return buf;
};

test("encryptFile defaults to V3 and round-trips", async () => {
  const original = new File([randomBytes(1000)], "b.bin");
  const enc = await encryptFile(original, "pw-test-1234");
  assert.equal(new Uint8Array(await enc.encryptedFile.arrayBuffer())[0], 0xfd);
  assert.equal((await roundTrip(3))[0], 0xfd);
});

test("legacy V1 and V2 files still decrypt", async () => {
  assert.equal((await roundTrip(1))[0], 0x02);
  assert.equal((await roundTrip(2))[0], 0xfe);
});

test("V3 rejects a wrong password", async () => {
  const enc = await encryptFile(new File([randomBytes(1000)], "c.bin"), "pw-test-1234");
  const dec = await decryptFile(await enc.encryptedFile.arrayBuffer(), "wrong-password", enc.metadata);
  assert.equal(dec.success, false);
});

test("legacy AES-GCM file whose salt starts with 0xFD is not mistaken for V3", async () => {
  const salt = randomBytes(16);
  salt[0] = 0xfd;
  const iv = randomBytes(12);
  const plain = randomBytes(5000);
  const km = await webcrypto.subtle.importKey("raw", new TextEncoder().encode("pw-test-1234"), "PBKDF2", false, ["deriveKey"]);
  const key = await webcrypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
    km, { name: "AES-GCM", length: 256 }, false, ["encrypt"]
  );
  const ct = new Uint8Array(await webcrypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plain));
  const blob = Buffer.concat([salt, iv, ct]);
  const dec = await decryptFile(blob, "pw-test-1234", { originalName: "g.bin", originalType: "application/octet-stream" });
  assert.equal(dec.success, true);
  assert.equal(Buffer.from(await dec.decryptedFile.arrayBuffer()).equals(plain), true);
});
