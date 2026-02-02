import { NextResponse } from "next/server";

// 인증이 필요한 경로 리스트
const PROTECTED_ROUTES = [
  "/dashboard",
  "/profile",
  "/settings",
  "/shared", // 공유된 파일 목록 페이지
  "/directory", // 디렉토리 페이지
  "/file", // 파일 상세 페이지
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

  // 공개 접근이 필요한 페이지
  "/",
  "/about",
  "/contact",

  // Next.js 시스템 경로
  "/_next",
  "/favicon.ico",
  "/public",
  
  // Better Auth API 경로
  "/api/auth",
];

// Better Auth 세션 쿠키 이름
const SESSION_COOKIE_NAME = "better-auth.session_token";

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

  // Better Auth 세션 쿠키 확인
  // Edge 런타임에서는 간단한 쿠키 존재 여부만 확인
  // 실제 세션 검증은 서버 사이드에서 수행
  const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (!sessionToken) {
    // 현재 URL을 콜백 URL로 저장하여 로그인 후 돌아올 수 있도록 함
    const signinUrl = new URL("/user/signin", request.url);
    signinUrl.searchParams.set("callbackUrl", request.nextUrl.pathname);

    return NextResponse.redirect(signinUrl);
  }

  // 세션 토큰이 존재하면 진행 (상세 검증은 서버 사이드에서)
  return NextResponse.next();
}

export const config = {
  matcher: [
    // API 라우트 및 모든 페이지 경로에 대해 미들웨어 적용
    "/api/:path*",
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
