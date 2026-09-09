/**
 * Choose a safe, stable path for an entry in a client-generated ZIP file.
 * Bulk downloads provide `path` so nested directory structure is preserved;
 * selected downloads use the original name as their flat path.
 */
export function getZipEntryName(file, usedNames = new Set()) {
  const requestedName = file?.path || file?.originalName || file?.name || "download";
  const segments = String(requestedName)
    .split(/[\\/]+/)
    .filter((segment) => segment && segment !== "." && segment !== "..")
    .map((segment) => segment.replace(/[\u0000-\u001f\u007f]/g, "_"));
  const safeName = segments.join("/") || "download";

  if (!usedNames.has(safeName)) {
    usedNames.add(safeName);
    return safeName;
  }

  const lastSlash = safeName.lastIndexOf("/");
  const directory = lastSlash >= 0 ? safeName.slice(0, lastSlash + 1) : "";
  const filename = lastSlash >= 0 ? safeName.slice(lastSlash + 1) : safeName;
  const extensionIndex = filename.lastIndexOf(".");
  const stem = extensionIndex > 0 ? filename.slice(0, extensionIndex) : filename;
  const extension = extensionIndex > 0 ? filename.slice(extensionIndex) : "";

  let suffix = 2;
  let candidate = `${directory}${stem} (${suffix})${extension}`;
  while (usedNames.has(candidate)) {
    suffix += 1;
    candidate = `${directory}${stem} (${suffix})${extension}`;
  }

  usedNames.add(candidate);
  return candidate;
}
export function getZipDownloadFailureMessage(failedFiles) {
  if (!failedFiles?.length) return null;

  return `${failedFiles.length}개 파일을 다운로드하지 못했습니다. 파일을 확인한 후 다시 시도해주세요.`;
}
