import { NextResponse } from "next/server";
import { verifyToken } from "./lib/auth/jwt";

// 인증이 필요한 경로 리스트
const PROTECTED_ROUTES = [
  "/dashboard",
  "/profile",
  "/settings",
  "/shared", // 공유된 파일 목록 페이지
  "/directory", // 디렉토리 페이지
  "/file", // 파일 상세 페이지
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
      (route) => pathname === route || pathname.startsWith(`${route}/`)
    )
  ) {
    return NextResponse.next();
  }

  // 보호된 경로인지 확인
  const isProtectedRoute = PROTECTED_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  // 보호된 경로가 아니라면 인증 검사 없이 진행
  if (!isProtectedRoute) {
    return NextResponse.next();
  }

  // 쿠키에서 토큰 가져오기
  const token = request.cookies.get("token")?.value;

  // 토큰이 없거나 유효하지 않으면 로그인 페이지로 리다이렉트
  const payload = await verifyToken(token);

  if (!token || !payload) {
    // 현재 URL을 콜백 URL로 저장하여 로그인 후 돌아올 수 있도록 함
    const signinUrl = new URL("/user/signin", request.url);
    signinUrl.searchParams.set("callbackUrl", request.nextUrl.pathname);

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
