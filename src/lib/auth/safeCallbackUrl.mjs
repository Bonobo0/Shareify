const DEFAULT_CALLBACK_URL = "/dashboard";
const CALLBACK_URL_ORIGIN = "https://shareify.invalid";

// C0 controls, DEL, and line separators must never be accepted in a redirect
// target. URL parsers may otherwise trim or normalize some of these characters.
const UNSAFE_CHARACTERS = /[\u0000-\u001f\u007f\u2028\u2029]/;

/**
 * Return whether a callback URL is an internal, relative URL.
 *
 * The callback is later passed to either Next's client router or URL's parser.
 * Backslashes are rejected everywhere because WHATWG URL parsing treats them
 * as forward slashes in special URLs, turning `/\\attacker.example` into an
 * external origin.
 */
export function isSafeInternalCallbackUrl(callbackUrl) {
  if (typeof callbackUrl !== "string" || callbackUrl.length === 0) {
    return false;
  }

  if (
    UNSAFE_CHARACTERS.test(callbackUrl) ||
    callbackUrl.includes("\\") ||
    !callbackUrl.startsWith("/") ||
    callbackUrl.startsWith("//")
  ) {
    return false;
  }

  try {
    // Parse against a fixed origin as a second line of defense. This catches
    // URL forms that a browser could reinterpret as an absolute URL.
    return new URL(callbackUrl, CALLBACK_URL_ORIGIN).origin === CALLBACK_URL_ORIGIN;
  } catch {
    return false;
  }
}

/**
 * Normalize an untrusted callback URL to a safe internal path.
 */
export function getSafeCallbackUrl(callbackUrl) {
  return isSafeInternalCallbackUrl(callbackUrl)
    ? callbackUrl
    : DEFAULT_CALLBACK_URL;
}

export { DEFAULT_CALLBACK_URL };
