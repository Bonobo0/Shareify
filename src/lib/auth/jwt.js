import * as jose from "jose";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const JWT_SECRET = process.env.JWT_SECRET;
const TOKEN_NAME = "auth_token";
const TOKEN_MAX_AGE = 7 * 24 * 60 * 60; // 7일

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET이 환경 변수에 설정되어 있지 않습니다.");
}

// 비밀키 변환
const textEncoder = new TextEncoder();
const secretKey = textEncoder.encode(JWT_SECRET);

// 토큰 생성
export async function generateToken(userId) {
  if (!userId) throw new Error("userId is required");

  try {
    return await new jose.SignJWT({ id: userId.toString() })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("7d")
      .sign(secretKey);
  } catch (error) {
    console.error("토큰 생성 오류:", error);
    throw new Error("토큰 생성 실패");
  }
}

// 토큰 검증
export async function verifyToken(token) {
  if (!token) return null;

  try {
    const { payload } = await jose.jwtVerify(token, secretKey, {
      algorithms: ["HS256"],
    });
    return payload;
  } catch (error) {
    console.error("토큰 검증 오류:", error);
    return null;
  }
}

// 쿠키에서 토큰 가져오기
export function getTokenFromCookie(req) {
  if (req?.cookies) {
    return req.cookies.get(TOKEN_NAME)?.value;
  }

  try {
    return cookies().get(TOKEN_NAME)?.value;
  } catch (error) {
    console.error("쿠키 접근 오류:", error);
    return null;
  }
}

// 토큰을 쿠키에 설정
export function setTokenCookie(token, response = null) {
  const cookieOptions = {
    name: TOKEN_NAME,
    value: token,
    httpOnly: true,
    maxAge: TOKEN_MAX_AGE,
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

// 쿠키 삭제
export function removeTokenCookie(response = null) {
  const cookieOptions = {
    name: TOKEN_NAME,
    value: "",
    maxAge: -1,
    path: "/",
  };

  if (response) {
    response.cookies.set(cookieOptions);
    return response;
  } else {
    cookies().set(cookieOptions);
  }
}

// 사용자 인증
export async function authenticateUser(req) {
  const token = getTokenFromCookie(req);
  if (!token) return null;

  const payload = await verifyToken(token);
  if (!payload || !payload.id) return null;

  return payload.id.toString();
}

// 로그인 성공 후 쿠키 설정
export async function setAuthCookie(userId) {
  try {
    if (!userId) throw new Error("userId is required");

    const token = await generateToken(userId.toString());
    const response = NextResponse.json({ success: true });
    return setTokenCookie(token, response);
  } catch (error) {
    console.error("인증 쿠키 설정 오류:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// 로그아웃 쿠키 삭제
export function clearAuthCookie() {
  const response = NextResponse.json({ success: true });
  return removeTokenCookie(response);
}
