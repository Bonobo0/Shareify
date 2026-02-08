"use client";

import { isMediaFile } from "@/lib/crypto/encryption";

export const formatBytes = (bytes, decimals = 2) => {
  if (!bytes) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
};

export const formatDate = (dateString) => {
  if (!dateString) return "";
  const date = new Date(dateString);
  return date.toLocaleString();
};

export const isPreviewable = (file) => {
  const mimetype = file.isEncrypted ? file.originalMimetype : file.mimetype;
  return isMediaFile(mimetype);
};

export const getFileIcon = (file) => {
  const mimetype = file.isEncrypted ? file.originalMimetype : file.mimetype;
  if (mimetype?.includes("image")) return "🖼️";
  if (mimetype?.includes("video")) return "🎬";
  if (mimetype?.includes("audio")) return "🎵";
  if (mimetype?.includes("pdf")) return "📄";
  if (mimetype?.includes("word") || mimetype?.includes("document"))
    return "📝";
  if (mimetype?.includes("spreadsheet") || mimetype?.includes("excel"))
    return "📊";
  if (mimetype?.includes("presentation") || mimetype?.includes("powerpoint"))
    return "📽️";
  if (mimetype?.includes("zip") || mimetype?.includes("compressed"))
    return "🗜️";
  return "📄";
};
