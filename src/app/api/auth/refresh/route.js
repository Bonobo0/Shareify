import { NextResponse } from "next/server";
import { rotateRefreshToken, setTokenCookies } from "@/lib/auth/jwt";

/**
 * Validate that a callback URL is a safe internal path (not an open redirect).
 * Only allows relative paths starting with '/'.
 */
function getSafeCallbackUrl(callbackUrl) {
  if (!callbackUrl || typeof callbackUrl !== "string") return "/dashboard";
  // Only allow relative paths (prevent open redirect)
  if (!callbackUrl.startsWith("/") || callbackUrl.startsWith("//")) return "/dashboard";
  return callbackUrl;
}

/**
 * Token refresh API endpoint
 * Called by middleware when access token is expired but refresh token exists.
 * Performs RTR (Refresh Token Rotation) and redirects back to the original URL.
 */
export async function GET(request) {
  const callbackUrl = getSafeCallbackUrl(request.nextUrl.searchParams.get("callbackUrl"));

  try {
    const refreshToken = request.cookies.get("refresh_token")?.value;

    if (!refreshToken) {
      const signinUrl = new URL("/user/signin", request.url);
      signinUrl.searchParams.set("callbackUrl", callbackUrl);
      return NextResponse.redirect(signinUrl);
    }

    const tokenPair = await rotateRefreshToken(refreshToken);

    if (!tokenPair) {
      const signinUrl = new URL("/user/signin", request.url);
      signinUrl.searchParams.set("callbackUrl", callbackUrl);
      return NextResponse.redirect(signinUrl);
    }

    // Redirect back to the original URL with new tokens set as cookies
    const redirectUrl = new URL(callbackUrl, request.url);
    const response = NextResponse.redirect(redirectUrl);
    return setTokenCookies(tokenPair.accessToken, tokenPair.refreshToken, response);
  } catch (error) {
    console.error("Token refresh API error:", error);
    const signinUrl = new URL("/user/signin", request.url);
    signinUrl.searchParams.set("callbackUrl", callbackUrl);
    return NextResponse.redirect(signinUrl);
  }
}
