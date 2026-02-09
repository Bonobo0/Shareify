"use client";

import { isMediaFile } from "@/lib/crypto/encryption";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faImage,
  faFilm,
  faMusic,
  faFile,
  faFileLines,
  faChartBar,
  faFileZipper,
} from "@fortawesome/free-solid-svg-icons";

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
  if (mimetype?.includes("image")) return <FontAwesomeIcon icon={faImage} />;
  if (mimetype?.includes("video")) return <FontAwesomeIcon icon={faFilm} />;
  if (mimetype?.includes("audio")) return <FontAwesomeIcon icon={faMusic} />;
  if (mimetype?.includes("pdf")) return <FontAwesomeIcon icon={faFile} />;
  if (mimetype?.includes("word") || mimetype?.includes("document"))
    return <FontAwesomeIcon icon={faFileLines} />;
  if (mimetype?.includes("spreadsheet") || mimetype?.includes("excel"))
    return <FontAwesomeIcon icon={faChartBar} />;
  if (mimetype?.includes("presentation") || mimetype?.includes("powerpoint"))
    return <FontAwesomeIcon icon={faFilm} />;
  if (mimetype?.includes("zip") || mimetype?.includes("compressed"))
    return <FontAwesomeIcon icon={faFileZipper} />;
  return <FontAwesomeIcon icon={faFile} />;
};
