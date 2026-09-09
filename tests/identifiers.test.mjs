import test from "node:test";
import assert from "node:assert/strict";
import {
  isDirectoryHash,
  isFileHash,
  isObjectIdString,
  isShareLinkHash,
} from "../src/lib/security/identifiers.mjs";

const fileHash = "a".repeat(32);
const shareHash = "b".repeat(40);
const objectId = "c".repeat(24);

test("accepts generated file, directory, and share-link identifiers", () => {
  assert.equal(isFileHash(fileHash), true);
  assert.equal(isDirectoryHash(fileHash), true);
  assert.equal(isShareLinkHash(shareHash), true);
  assert.equal(isObjectIdString(objectId), true);
});

test("rejects Mongo-shaped values and malformed identifier lengths", () => {
  const operator = { $ne: null };

  assert.equal(isFileHash(operator), false);
  assert.equal(isDirectoryHash(operator), false);
  assert.equal(isShareLinkHash(operator), false);
  assert.equal(isFileHash(`${fileHash}0`), false);
  assert.equal(isShareLinkHash(fileHash), false);
  assert.equal(isObjectIdString(operator), false);
  assert.equal(isObjectIdString("not-an-object-id"), false);
});
