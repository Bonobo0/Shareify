import assert from "node:assert/strict";
import test from "node:test";

import {
  createEmptyUploadQueueState,
  getFilesToUpload,
  getUploadQueueStateForSelection,
  getUploadFileKey,
} from "../src/app/components/fileUploader/uploadQueue.mjs";

test("keeps duplicate filenames as independent queue entries", () => {
  const files = [
    { name: "report.pdf", size: 10 },
    { name: "report.pdf", size: 20 },
  ];

  const entries = getFilesToUpload(files, {}, false);

  assert.deepEqual(
    entries.map(({ index }) => index),
    [0, 1],
  );
  assert.notEqual(
    getUploadFileKey(entries[0].index),
    getUploadFileKey(entries[1].index),
  );
});

test("retries only the failed duplicate file", () => {
  const files = [
    { name: "report.pdf", size: 10 },
    { name: "report.pdf", size: 20 },
  ];
  const uploadResults = {
    [getUploadFileKey(0)]: { status: "success", fileId: "file-1" },
    [getUploadFileKey(1)]: { status: "error", error: "network" },
  };

  const retryEntries = getFilesToUpload(files, uploadResults, true);

  assert.deepEqual(
    retryEntries.map(({ index }) => index),
    [1],
  );
});

test("a new selection resets queue state and is ignored while uploading", () => {
  const newFiles = [{ name: "report.pdf", size: 30 }];
  const previousResults = {
    [getUploadFileKey(0)]: { status: "success", fileId: "old-file" },
  };
  const emptyQueue = createEmptyUploadQueueState();
  const nextQueue = getUploadQueueStateForSelection(newFiles, false);

  assert.deepEqual(getFilesToUpload(newFiles, previousResults, true), []);
  assert.deepEqual(
    getFilesToUpload(newFiles, nextQueue.uploadResults, true).map(
      ({ index }) => index,
    ),
    [0],
  );
  assert.deepEqual(nextQueue.progress, emptyQueue.progress);
  assert.deepEqual(nextQueue.uploadResults, emptyQueue.uploadResults);
  assert.equal(nextQueue.retryMode, emptyQueue.retryMode);
  assert.equal(getUploadQueueStateForSelection(newFiles, true), null);
});
