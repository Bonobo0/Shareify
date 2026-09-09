/**
 * Return the stable key used for a file while it remains in the current
 * selection. The index is intentionally part of the key because filenames
 * are not unique (two selected files may have the same name).
 */
export function getUploadFileKey(index) {
  return String(index);
}

export function createEmptyUploadQueueState() {
  return {
    progress: {},
    uploadResults: {},
    retryMode: false,
  };
}

export function getUploadQueueStateForSelection(files, isUploading = false) {
  if (isUploading || !files?.length) return null;

  return {
    files,
    ...createEmptyUploadQueueState(),
  };
}

/**
 * Keep the original selection index when choosing files for a retry. This
 * lets the caller reuse per-file progress/results without conflating files
 * that happen to share a filename.
 */
export function getFilesToUpload(files, uploadResults = {}, isRetry = false) {
  return files
    .map((file, index) => ({ file, index }))
    .filter(({ index }) => {
      if (!isRetry) return true;

      const result = uploadResults[getUploadFileKey(index)];
      return !result || result.status === "error";
    });
}
