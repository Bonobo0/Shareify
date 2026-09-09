const HEX_TOKEN_PATTERN = /^[0-9a-f]{64}$/i;

// Password-reset and email-verification tokens are generated from 32 random
// bytes. Keep this check strict before a value reaches a Mongo query so an
// object containing a Mongo operator cannot be interpreted as a filter.
export function isHexToken(value) {
  return typeof value === "string" && HEX_TOKEN_PATTERN.test(value);
}
