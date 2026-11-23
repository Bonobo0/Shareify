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

test("web decryptFile restores files encrypted by shareify_cli.py", { skip: !hasCliDeps }, async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "shareify-cli-"));
  try {
    const source = path.join(dir, "source.bin");
    const encrypted = path.join(dir, "source.bin.encrypted");
    const original = randomBytes(5 * 1024 * 1024 * 2 + 70_000);
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

    const decrypted = await decryptFile(readFileSync(encrypted), "pw-test", {
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
