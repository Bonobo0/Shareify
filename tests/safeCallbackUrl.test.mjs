import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_CALLBACK_URL,
  getSafeCallbackUrl,
  isSafeInternalCallbackUrl,
} from "../src/lib/auth/safeCallbackUrl.mjs";

test("falls back for non-string and missing callback URLs", () => {
  for (const callbackUrl of [undefined, null, "", 42, {}, "dashboard", "?tab=files"]) {
    assert.equal(getSafeCallbackUrl(callbackUrl), DEFAULT_CALLBACK_URL);
    assert.equal(isSafeInternalCallbackUrl(callbackUrl), false);
  }
});

test("rejects callback URLs that can redirect outside the app", () => {
  const maliciousCallbackUrls = [
    "javascript:alert(1)",
    "https://attacker.example/phishing",
    "//attacker.example/phishing",
    "///attacker.example/phishing",
    "/\\attacker.example/phishing",
    "/\\\\attacker.example/phishing",
    "/dashboard\u0000",
    "/dashboard\nSet-Cookie: forged=value",
    "/dashboard\r\nLocation: https://attacker.example",
    "/dashboard\t",
    "/dashboard\u007f",
  ];

  for (const callbackUrl of maliciousCallbackUrls) {
    assert.equal(
      getSafeCallbackUrl(callbackUrl),
      DEFAULT_CALLBACK_URL,
      `expected ${JSON.stringify(callbackUrl)} to use the fallback`,
    );
    assert.equal(isSafeInternalCallbackUrl(callbackUrl), false);
  }
});

test("preserves valid internal paths and queries", () => {
  const validCallbackUrls = [
    "/dashboard",
    "/file/abc123?tab=preview",
    "/search?q=https%3A%2F%2Fattacker.example&sort=desc",
    "/directory/team%2Fshared#recent",
  ];

  for (const callbackUrl of validCallbackUrls) {
    assert.equal(getSafeCallbackUrl(callbackUrl), callbackUrl);
    assert.equal(isSafeInternalCallbackUrl(callbackUrl), true);
    assert.equal(new URL(callbackUrl, "https://shareify.invalid").origin, "https://shareify.invalid");
  }
});
