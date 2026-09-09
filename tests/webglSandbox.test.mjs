import test from "node:test";
import assert from "node:assert/strict";
import {
  WEBGL_BOOTSTRAP_HTML,
  WEBGL_FRAME_MESSAGE_SOURCE,
  WEBGL_PARENT_MESSAGE_SOURCE,
  WEBGL_SANDBOX,
} from "../src/lib/webgl/sandbox.mjs";

test("WebGL sandbox stays opaque while allowing the game runtime", () => {
  assert.equal(WEBGL_SANDBOX, "allow-scripts allow-pointer-lock");
  assert.doesNotMatch(WEBGL_SANDBOX, /allow-same-origin/);
  assert.match(WEBGL_BOOTSTRAP_HTML, /URL\.createObjectURL/);
  assert.match(WEBGL_BOOTSTRAP_HTML, /URL\.revokeObjectURL/);
  assert.match(WEBGL_BOOTSTRAP_HTML, new RegExp(WEBGL_PARENT_MESSAGE_SOURCE));
  assert.match(WEBGL_BOOTSTRAP_HTML, new RegExp(WEBGL_FRAME_MESSAGE_SOURCE));
});

test("WebGL bootstrap only accepts parent-originated control messages", () => {
  assert.match(
    WEBGL_BOOTSTRAP_HTML,
    /event\.source\s*!==\s*window\.parent/,
  );
  assert.match(
    WEBGL_BOOTSTRAP_HTML,
    /event\.data\.source\s*!==\s*parentMessageSource/,
  );
});
