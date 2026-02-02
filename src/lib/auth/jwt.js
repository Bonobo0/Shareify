import * as jose from "jose";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import crypto from "crypto";
import {
  storeRefreshToken,
  validateRefreshToken,
  invalidateRefreshToken,
} from "@/lib/redis/client";

const JWT_SECRET = process.env.JWT_SECRET;
const ACCESS_TOKEN_NAME = "access_token";
const REFRESH_TOKEN_NAME = "refresh_token";
const ACCESS_TOKEN_MAX_AGE = 15 * 60; // 15분
const REFRESH_TOKEN_MAX_AGE = 7 * 24 * 60 * 60; // 7일

if (!JWT_SECRET) {
  console.error("JWT_SECRET environment variable is not set");
  throw new Error("JWT_SECRET이 환경 변수에 설정되어 있지 않습니다.");
}

// 비밀키 변환
const textEncoder = new TextEncoder();
const secretKey = textEncoder.encode(JWT_SECRET);

/**
 * Generate unique JWT ID for refresh token tracking
 * @returns {string} Unique JWT ID
 */
function generateJti() {
  return crypto.randomUUID();
}

/**
 * Generate access token (short-lived: 15 minutes)
 * @param {string} userId - User ID
 * @returns {Promise<string>} Access token
 */
export async function generateAccessToken(userId) {
  if (!userId) throw new Error("userId is required");

  try {
    return await new jose.SignJWT({
      userId: userId.toString(),
      type: "access",
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("15m")
      .sign(secretKey);
  } catch (error) {
    console.error("Access 토큰 생성 오류:", error);
    throw new Error("Access 토큰 생성 실패");
  }
}

/**
 * Generate refresh token (long-lived: 7 days) with JTI for RTR
 * @param {string} userId - User ID
 * @returns {Promise<{token: string, jti: string}>} Refresh token and JTI
 */
export async function generateRefreshToken(userId) {
  if (!userId) throw new Error("userId is required");

  const jti = generateJti();

  try {
    const token = await new jose.SignJWT({
      userId: userId.toString(),
      type: "refresh",
      jti,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("7d")
      .sign(secretKey);

    // Store refresh token in Redis
    await storeRefreshToken(userId.toString(), jti, REFRESH_TOKEN_MAX_AGE);

    return { token, jti };
  } catch (error) {
    console.error("Refresh 토큰 생성 오류:", error);
    throw new Error("Refresh 토큰 생성 실패");
  }
}

/**
 * Generate both access and refresh tokens (for login/signup)
 * @param {string} userId - User ID
 * @returns {Promise<{accessToken: string, refreshToken: string}>} Token pair
 */
export async function generateTokenPair(userId) {
  const accessToken = await generateAccessToken(userId);
  const { token: refreshToken } = await generateRefreshToken(userId);
  return { accessToken, refreshToken };
}

// 기존 generateToken 함수 - 하위 호환성 유지 (deprecated)
export async function generateToken(userId) {
  console.warn(
    "generateToken is deprecated. Use generateAccessToken or generateTokenPair instead."
  );
  return generateAccessToken(userId);
}

/**
 * Verify any token (access or refresh)
 * @param {string} token - JWT token
 * @returns {Promise<object|null>} Token payload or null if invalid
 */
export async function verifyToken(token) {
  if (!token || typeof token !== "string") {
    console.error("Invalid token format:", token);
    return null;
  }

  try {
    const { payload } = await jose.jwtVerify(token, secretKey, {
      algorithms: ["HS256"],
    });
    return payload;
  } catch (error) {
    console.error("토큰 검증 오류:", error.message);
    return null;
  }
}

/**
 * Verify access token
 * @param {string} token - Access token
 * @returns {Promise<object|null>} Token payload or null if invalid
 */
export async function verifyAccessToken(token) {
  const payload = await verifyToken(token);
  if (!payload || payload.type !== "access") {
    return null;
  }
  return payload;
}

/**
 * Verify refresh token and check Redis for validity (RTR)
 * @param {string} token - Refresh token
 * @returns {Promise<object|null>} Token payload or null if invalid
 */
export async function verifyRefreshToken(token) {
  const payload = await verifyToken(token);
  if (!payload || payload.type !== "refresh" || !payload.jti) {
    return null;
  }

  // Check if refresh token is still valid in Redis (RTR check)
  const isValid = await validateRefreshToken(payload.userId, payload.jti);
  if (!isValid) {
    console.error("Refresh token not found in Redis (possibly rotated or revoked)");
    return null;
  }

  return payload;
}

/**
 * Rotate refresh token (RTR: Refresh Token Rotation)
 * Invalidates old refresh token and generates new token pair
 * @param {string} oldRefreshToken - Current refresh token
 * @returns {Promise<{accessToken: string, refreshToken: string}|null>} New token pair or null
 */
export async function rotateRefreshToken(oldRefreshToken) {
  const payload = await verifyRefreshToken(oldRefreshToken);
  if (!payload) {
    return null;
  }

  // Invalidate old refresh token in Redis
  await invalidateRefreshToken(payload.userId, payload.jti);

  // Generate new token pair
  const tokenPair = await generateTokenPair(payload.userId);
  return tokenPair;
}

/**
 * Get access token from cookie
 * @param {object} req - Request object (optional)
 * @returns {string|null} Access token or null
 */
export function getAccessTokenFromCookie(req) {
  if (req?.cookies) {
    return req.cookies.get(ACCESS_TOKEN_NAME)?.value;
  }

  try {
    return cookies().get(ACCESS_TOKEN_NAME)?.value;
  } catch (error) {
    console.error("쿠키 접근 오류:", error);
    return null;
  }
}

/**
 * Get refresh token from cookie
 * @param {object} req - Request object (optional)
 * @returns {string|null} Refresh token or null
 */
export function getRefreshTokenFromCookie(req) {
  if (req?.cookies) {
    return req.cookies.get(REFRESH_TOKEN_NAME)?.value;
  }

  try {
    return cookies().get(REFRESH_TOKEN_NAME)?.value;
  } catch (error) {
    console.error("쿠키 접근 오류:", error);
    return null;
  }
}

// 기존 함수 호환성 유지 (access_token 우선, fallback으로 refresh_token)
export function getTokenFromCookie(req) {
  return getAccessTokenFromCookie(req) || getRefreshTokenFromCookie(req);
}

/**
 * Set both access and refresh tokens as cookies
 * @param {string} accessToken - Access token
 * @param {string} refreshToken - Refresh token
 * @param {object} response - Response object (optional)
 */
export function setTokenCookies(accessToken, refreshToken, response = null) {
  const accessCookieOptions = {
    name: ACCESS_TOKEN_NAME,
    value: accessToken,
    httpOnly: true,
    maxAge: ACCESS_TOKEN_MAX_AGE,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  };

  const refreshCookieOptions = {
    name: REFRESH_TOKEN_NAME,
    value: refreshToken,
    httpOnly: true,
    maxAge: REFRESH_TOKEN_MAX_AGE,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  };

  if (response) {
    response.cookies.set(accessCookieOptions);
    response.cookies.set(refreshCookieOptions);
    return response;
  } else {
    cookies().set(accessCookieOptions);
    cookies().set(refreshCookieOptions);
  }
}

// 기존 함수 호환성 유지 (deprecated)
export function setTokenCookie(token, response = null) {
  console.warn("setTokenCookie is deprecated. Use setTokenCookies instead.");
  const cookieOptions = {
    name: ACCESS_TOKEN_NAME,
    value: token,
    httpOnly: true,
    maxAge: ACCESS_TOKEN_MAX_AGE,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  };

  if (response) {
    response.cookies.set(cookieOptions);
    return response;
  } else {
    cookies().set(cookieOptions);
  }
}

/**
 * Remove both token cookies
 * @param {object} response - Response object (optional)
 */
export function removeTokenCookies(response = null) {
  const accessCookieOptions = {
    name: ACCESS_TOKEN_NAME,
    value: "",
    maxAge: -1,
    path: "/",
  };

  const refreshCookieOptions = {
    name: REFRESH_TOKEN_NAME,
    value: "",
    maxAge: -1,
    path: "/",
  };

  if (response) {
    response.cookies.set(accessCookieOptions);
    response.cookies.set(refreshCookieOptions);
    return response;
  } else {
    cookies().set(accessCookieOptions);
    cookies().set(refreshCookieOptions);
  }
}

// 기존 함수 호환성 유지
export function removeTokenCookie(response = null) {
  return removeTokenCookies(response);
}

/**
 * Authenticate user from access token
 * @param {object} req - Request object
 * @returns {Promise<string|null>} User ID or null
 */
export async function authenticateUser(req) {
  const token = getAccessTokenFromCookie(req);
  if (!token) return null;

  const payload = await verifyAccessToken(token);
  if (!payload || !payload.userId) return null;

  return payload.userId.toString();
}

/**
 * Set auth cookies after login/signup
 * @param {string} userId - User ID
 * @returns {Promise<NextResponse>} Response with cookies
 */
export async function setAuthCookies(userId) {
  try {
    if (!userId) throw new Error("userId is required");

    const { accessToken, refreshToken } = await generateTokenPair(
      userId.toString()
    );
    const response = NextResponse.json({ success: true });
    return setTokenCookies(accessToken, refreshToken, response);
  } catch (error) {
    console.error("인증 쿠키 설정 오류:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// 기존 함수 호환성 유지 (deprecated)
export async function setAuthCookie(userId) {
  console.warn("setAuthCookie is deprecated. Use setAuthCookies instead.");
  return setAuthCookies(userId);
}

/**
 * Clear auth cookies and invalidate refresh token
 * @param {string} refreshToken - Refresh token to invalidate (optional)
 * @returns {NextResponse} Response with cleared cookies
 */
export async function clearAuthCookies(refreshToken = null) {
  // If refresh token provided, invalidate it in Redis
  if (refreshToken) {
    const payload = await verifyToken(refreshToken);
    if (payload && payload.jti) {
      await invalidateRefreshToken(payload.userId, payload.jti);
    }
  }

  const response = NextResponse.json({ success: true });
  return removeTokenCookies(response);
}

// 기존 함수 호환성 유지
export function clearAuthCookie() {
  const response = NextResponse.json({ success: true });
  return removeTokenCookies(response);
}
