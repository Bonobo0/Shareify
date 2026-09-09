import assert from "node:assert/strict";
import test from "node:test";

import {
  getZipDownloadFailureMessage,
  getZipEntryName,
} from "../src/lib/downloadZipUtils.mjs";

test("preserves nested bulk-download paths and strips traversal segments", () => {
  const usedNames = new Set();

  assert.equal(
    getZipEntryName(
      { path: "Projects/../Build/game.loader.js", originalName: "fallback.js" },
      usedNames,
    ),
    "Projects/Build/game.loader.js",
  );
});
test("keeps duplicate ZIP names instead of overwriting an entry", () => {
  const usedNames = new Set();

  assert.equal(getZipEntryName({ path: "folder/report.txt" }, usedNames), "folder/report.txt");
  assert.equal(getZipEntryName({ path: "folder/report.txt" }, usedNames), "folder/report (2).txt");
  assert.equal(getZipEntryName({ path: "folder/report.txt" }, usedNames), "folder/report (3).txt");
});

test("reports failed files so callers do not mark a partial ZIP complete", () => {
  const failedFiles = [{ file: "one.bin", error: "network" }];

  assert.match(getZipDownloadFailureMessage(failedFiles), /다운로드하지 못했습니다/);
  assert.equal(getZipDownloadFailureMessage([]), null);
});
