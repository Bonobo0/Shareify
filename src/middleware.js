import { NextResponse } from "next/server";
import { verifyAccessToken } from "./lib/auth/edgeAccessToken";

/**
 * Check if a request is a Next.js server action (POST with Next-Action header).
 * Server actions must not be redirected because 303 forces GET, losing the POST.
 */
function isServerAction(request) {
  return request.method === "POST" && request.headers.has("next-action");
}

/**
 * Parse a Set-Cookie header string into { name, value, options }.
 */
function parseSetCookie(setCookieStr) {
  const eqIndex = setCookieStr.indexOf("=");
  if (eqIndex < 0) return null;

  const name = setCookieStr.substring(0, eqIndex).trim();
  const rest = setCookieStr.substring(eqIndex + 1);
  const semicolonIndex = rest.indexOf(";");
  const value = (semicolonIndex >= 0 ? rest.substring(0, semicolonIndex) : rest).trim();

  const options = {};
  if (semicolonIndex >= 0) {
    const parts = rest.substring(semicolonIndex + 1).split(";");
    for (const part of parts) {
      const trimmed = part.trim();
      const lower = trimmed.toLowerCase();
      if (lower === "httponly") options.httpOnly = true;
      else if (lower === "secure") options.secure = true;
      else if (lower.startsWith("max-age=")) {
        const maxAge = parseInt(lower.substring(8), 10);
        if (!isNaN(maxAge)) options.maxAge = maxAge;
      }
      else if (lower.startsWith("path=")) options.path = trimmed.substring(5);
      else if (lower.startsWith("samesite=")) options.sameSite = trimmed.substring(9).toLowerCase();
    }
  }

  return { name, value, options };
}

// 인증이 필요한 경로 리스트
const PROTECTED_ROUTES = [
  "/dashboard",
  "/profile",
  "/settings",
  "/shared", // 공유된 파일 목록 페이지
  "/directory", // 디렉토리 페이지
  "/file", // 파일 상세 페이지
  "/editor", // 에디터 페이지
  "/admin", // 관리자 페이지
  "/api/share", // 공유 관련 API
  // 인증이 필요한 다른 경로들 추가
];

// 인증 우회 경로 (예: API 경로, 정적 파일 경로 등)
const BYPASS_ROUTES = [
  // 인증 관련 페이지
  "/user/signin",
  "/user/signup",
  "/user/forgot-password",
  "/user/reset-password",

  // 토큰 갱신 API
  "/api/auth/refresh",

  // 공개 접근이 필요한 페이지
  "/",
  "/about",
  "/contact",

  // Next.js 시스템 경로
  "/_next",
  "/favicon.ico",
  "/public",
];

export async function middleware(request) {
  const { pathname } = request.nextUrl;

  // 우회 경로는 인증 검사 건너뜀
  if (
    BYPASS_ROUTES.some(
      (route) => pathname === route || pathname.startsWith(`${route}/`),
    )
  ) {
    return NextResponse.next();
  }

  // 보호된 경로인지 확인
  const isProtectedRoute = PROTECTED_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );

  // 보호된 경로가 아니라면 인증 검사 없이 진행
  if (!isProtectedRoute) {
    return NextResponse.next();
  }

  // 쿠키에서 access_token 가져오기
  const accessToken = request.cookies.get("access_token")?.value;

  // access_token 검증
  const payload = await verifyAccessToken(accessToken);

  if (!accessToken || !payload) {
    // access_token이 없거나 만료된 경우, refresh_token으로 갱신 시도
    const refreshToken = request.cookies.get("refresh_token")?.value;

    if (refreshToken) {
      // Server action인 경우, 리다이렉트 대신 인라인으로 토큰 갱신 후 요청 계속 진행
      // (303 리다이렉트는 POST를 GET으로 변환하므로 server action이 유실됨)
      if (isServerAction(request)) {
        try {
          const refreshUrl = new URL("/api/auth/refresh", request.url);
          refreshUrl.searchParams.set("callbackUrl", request.nextUrl.pathname + request.nextUrl.search);

          const refreshResponse = await fetch(refreshUrl.toString(), {
            headers: {
              Cookie: `refresh_token=${refreshToken}`,
            },
            redirect: "manual",
          });

          // getSetCookie() may not be available in all Edge Runtime versions
          const setCookieHeaders = refreshResponse.headers.getSetCookie?.() ?? [];

          let hasNewAccessToken = false;
          const parsedCookies = [];

          for (const cookieStr of setCookieHeaders) {
            const parsed = parseSetCookie(cookieStr);
            if (parsed) {
              parsedCookies.push(parsed);
              if (parsed.name === "access_token" && parsed.value) {
                hasNewAccessToken = true;
              }
            }
          }

          if (hasNewAccessToken) {
            // 토큰 갱신 성공 - 새 쿠키를 설정하고 원래 요청을 계속 진행
            const response = NextResponse.next();
            for (const { name, value, options } of parsedCookies) {
              response.cookies.set(name, value, options);
            }
            return response;
          }
        } catch (error) {
          console.error("Server action token refresh error:", error);
        }

        // 토큰 갱신 실패 시 로그인 페이지로 리다이렉트
        const signinUrl = new URL("/user/signin", request.url);
        signinUrl.searchParams.set("callbackUrl", request.nextUrl.pathname + request.nextUrl.search);
        return NextResponse.redirect(signinUrl);
      }

      // 일반 요청(페이지 로드 등)은 기존 리다이렉트 방식 유지
      const refreshUrl = new URL("/api/auth/refresh", request.url);
      refreshUrl.searchParams.set("callbackUrl", request.nextUrl.pathname + request.nextUrl.search);
      return NextResponse.redirect(refreshUrl, 303);
    }

    // refresh_token도 없으면 로그인 페이지로 리다이렉트
    const signinUrl = new URL("/user/signin", request.url);
    signinUrl.searchParams.set("callbackUrl", request.nextUrl.pathname + request.nextUrl.search);
    return NextResponse.redirect(signinUrl);
  }

  // 인증 성공: 요청 진행
  return NextResponse.next();
}

export const config = {
  matcher: [
    // API 라우트 및 모든 페이지 경로에 대해 미들웨어 적용
    "/api/:path*",
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
