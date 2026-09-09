export const PDF_MAGIC = "%PDF-";

export function isAllowedPdfPreviewSource(source, baseUrl) {
  if (typeof source !== "string" || !source.trim()) return false;

  try {
    const parsed = new URL(source, baseUrl);
    return ["https:", "http:", "blob:"].includes(parsed.protocol);
  } catch {
    return false;
  }
}

export function hasPdfMagic(bytes) {
  if (!(bytes instanceof Uint8Array)) return false;

  const header = new TextDecoder().decode(bytes.subarray(0, 1024));
  const magicIndex = header.indexOf(PDF_MAGIC);
  return magicIndex >= 0 && magicIndex < 1024;
}
