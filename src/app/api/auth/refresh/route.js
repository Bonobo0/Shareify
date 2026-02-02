import { NextResponse } from "next/server";
import {
  getRefreshTokenFromCookie,
  rotateRefreshToken,
  setTokenCookies,
} from "@/lib/auth/jwt";

export const runtime = "nodejs";

/**
 * POST /api/auth/refresh
 * Refresh access token using refresh token (RTR - Refresh Token Rotation)
 *
 * This endpoint:
 * 1. Validates the current refresh token
 * 2. Invalidates the old refresh token in Redis
 * 3. Generates a new access token + refresh token pair
 * 4. Sets both tokens as HttpOnly cookies
 */
export async function POST(request) {
  try {
    // Get refresh token from cookie
    const refreshToken = getRefreshTokenFromCookie(request);

    if (!refreshToken) {
      return NextResponse.json(
        { error: "Refresh token이 없습니다." },
        { status: 401 }
      );
    }

    // Rotate refresh token (RTR)
    const tokenPair = await rotateRefreshToken(refreshToken);

    if (!tokenPair) {
      return NextResponse.json(
        { error: "유효하지 않거나 만료된 refresh token입니다." },
        { status: 401 }
      );
    }

    // Set new tokens as cookies
    const response = NextResponse.json({
      success: true,
      message: "토큰이 갱신되었습니다.",
    });

    setTokenCookies(tokenPair.accessToken, tokenPair.refreshToken, response);

    return response;
  } catch (error) {
    console.error("Token refresh error:", error);
    return NextResponse.json(
      { error: "토큰 갱신 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
