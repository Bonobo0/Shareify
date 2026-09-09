const HEX_HASH_PATTERN = /^[0-9a-f]+$/i;

export const FILE_HASH_LENGTH = 32;
export const DIRECTORY_HASH_LENGTH = 32;
export const SHARE_LINK_HASH_LENGTH = 40;

/**
 * Hashes are exposed as route/action identifiers. Keep them as strings before
 * they reach a Mongo query so an object such as { $ne: null } cannot become a
 * query operator.
 */
export function isHexHash(value, length) {
  return (
    typeof value === "string" &&
    value.length === length &&
    HEX_HASH_PATTERN.test(value)
  );
}

export function isFileHash(value) {
  return isHexHash(value, FILE_HASH_LENGTH);
}

export function isDirectoryHash(value) {
  return isHexHash(value, DIRECTORY_HASH_LENGTH);
}

export function isShareLinkHash(value) {
  return isHexHash(value, SHARE_LINK_HASH_LENGTH);
}

export function isObjectIdString(value) {
  return typeof value === "string" && /^[0-9a-f]{24}$/i.test(value);
}
