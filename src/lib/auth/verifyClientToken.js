import crypto from "crypto";
import { NextResponse } from "next/server";

/**
 * Parse the AI_CLIENT_TOKENS environment variable once at module load time.
 * Value is a comma-separated list of accepted tokens.
 * @type {string[]}
 */
const ALLOWED_TOKENS = (process.env.AI_CLIENT_TOKENS || "")
  .split(",")
  .map((t) => t.trim())
  .filter(Boolean);

/**
 * Extract a bearer token from an Authorization header value.
 * Returns null when the header is absent or the scheme is not "Bearer".
 *
 * @param {string | null} authorization
 * @returns {string | null}
 */
export function extractBearerToken(authorization) {
  if (!authorization) return null;
  const spaceIdx = authorization.indexOf(" ");
  if (spaceIdx === -1) return null;
  const scheme = authorization.slice(0, spaceIdx);
  if (scheme.toLowerCase() !== "bearer") return null;
  const token = authorization.slice(spaceIdx + 1).trim();
  return token || null;
}

/**
 * Verify a client token supplied via either
 *   - Authorization: Bearer <token>
 *   - X-Client-Token: <token>
 *
 * Uses constant-time comparison to prevent timing attacks.
 * Tokens are loaded from the AI_CLIENT_TOKENS environment variable
 * (comma-separated list).
 *
 * @param {import("next/server").NextRequest} request
 * @returns {NextResponse | null}  A 401 NextResponse when verification fails,
 *                                  or null when the token is valid.
 */
export function verifyClientToken(request) {
  const authorization = request.headers.get("authorization");
  const xClientToken = request.headers.get("x-client-token");

  const token =
    extractBearerToken(authorization) ||
    (xClientToken ? xClientToken.trim() : null) ||
    null;

  if (!token) {
    return NextResponse.json(
      { error: "Missing client token." },
      {
        status: 401,
        headers: { "WWW-Authenticate": "Bearer" },
      }
    );
  }

  const tokenBuf = Buffer.from(token);
  for (const allowed of ALLOWED_TOKENS) {
    try {
      const allowedBuf = Buffer.from(allowed);
      if (
        tokenBuf.length === allowedBuf.length &&
        crypto.timingSafeEqual(tokenBuf, allowedBuf)
      ) {
        return null; // valid
      }
    } catch {
      // ignore — treated as not equal
    }
  }

  return NextResponse.json(
    { error: "Invalid client token." },
    {
      status: 401,
      headers: { "WWW-Authenticate": "Bearer" },
    }
  );
}
