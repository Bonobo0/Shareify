import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { decryptFile } from "../src/lib/crypto/encryption.js";

const python = process.platform === "win32" ? "python" : "python3";
const hasCliDeps =
  spawnSync(python, ["-c", "import requests, cryptography"]).status === 0;

test("shareify_cli.py writes V3 without keystream reuse and web decryptFile restores it", { skip: !hasCliDeps }, async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "shareify-cli-"));
  try {
    const source = path.join(dir, "source.bin");
    const encrypted = path.join(dir, "source.bin.encrypted");
    const chunk = 5 * 1024 * 1024;
    const original = randomBytes(chunk * 2 + 70_000);
    // Same plaintext at the start of chunk 0 and chunk 1, and in two adjacent sub-chunks.
    original.copy(original, chunk, 0, 64 * 1024);
    original.copy(original, 64 * 1024 + 16, 0, 64 * 1024 - 16);
    writeFileSync(source, original);

    const script = [
      "import sys",
      "sys.path.insert(0, sys.argv[1])",
      "import shareify_cli",
      "plan = shareify_cli.build_encryption_plan(sys.argv[2], 'pw-test', None)",
      "open(sys.argv[3], 'wb').write(b''.join(plan.stream_factory()))",
    ].join("\n");
    const result = spawnSync(python, ["-c", script, path.resolve("scripts"), source, encrypted]);
    assert.equal(result.status, 0, result.stderr?.toString());

    const blob = readFileSync(encrypted);
    assert.equal(blob[0], 0xfd, "CLI should write the V3 format");
    const body = blob.subarray(70);
    const keystream = (offset, length) =>
      Buffer.from(body.subarray(offset, offset + length).map((b, i) => b ^ original[offset + i]));
    // V1/V2 reused keystream across 5MiB chunks and between shifted 64KB sub-chunks.
    assert.notDeepEqual(keystream(0, 4096), keystream(chunk, 4096));
    assert.notDeepEqual(keystream(16, 4096), keystream(64 * 1024, 4096));

    const decrypted = await decryptFile(blob, "pw-test", {
      originalName: "source.bin",
      originalType: "application/octet-stream",
    });
    assert.equal(decrypted.success, true);
    const bytes = Buffer.from(await decrypted.decryptedFile.arrayBuffer());
    assert.equal(bytes.equals(original), true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
