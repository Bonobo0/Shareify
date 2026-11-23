import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
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
