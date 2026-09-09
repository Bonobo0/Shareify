import test from "node:test";
import assert from "node:assert/strict";
import {
  hasPdfMagic,
  isAllowedPdfPreviewSource,
} from "../src/app/components/pdfPreviewUtils.mjs";

test("allows only fetchable HTTP(S), blob, or relative PDF sources", () => {
  const baseUrl = "https://shareify.example/files/preview";

  assert.equal(isAllowedPdfPreviewSource("https://cdn.example/file", baseUrl), true);
  assert.equal(isAllowedPdfPreviewSource("http://localhost/file", baseUrl), true);
  assert.equal(isAllowedPdfPreviewSource("blob:https://shareify.example/id", baseUrl), true);
  assert.equal(isAllowedPdfPreviewSource("/api/files/preview", baseUrl), true);
  assert.equal(isAllowedPdfPreviewSource("javascript:alert(1)", baseUrl), false);
  assert.equal(isAllowedPdfPreviewSource("data:text/html,<script>alert(1)</script>", baseUrl), false);
  assert.equal(isAllowedPdfPreviewSource("", baseUrl), false);
});

test("requires a PDF magic header within the first kilobyte", () => {
  assert.equal(hasPdfMagic(new TextEncoder().encode("%PDF-1.7\nbody")), true);
  assert.equal(hasPdfMagic(new TextEncoder().encode("not a PDF")), false);

  const lateHeader = new Uint8Array(1024 + 5);
  lateHeader.set(new TextEncoder().encode("%PDF-"), 1024);
  assert.equal(hasPdfMagic(lateHeader), false);
});
