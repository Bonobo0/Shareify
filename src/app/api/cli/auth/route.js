import { NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db/mongodb";
import User from "@/models/User";
import { checkActionRateLimit } from "@/lib/actionRateLimit";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const rateLimitResult = await checkActionRateLimit("signin");
    if (!rateLimitResult.allowed) {
      const response = NextResponse.json(
        { error: rateLimitResult.error },
        { status: 429 }
      );
      if (rateLimitResult.retryAfter) {
        response.headers.set("Retry-After", String(rateLimitResult.retryAfter));
      }
      return response;
    }

    const body = await request.json();
    const {
      email,
      password,
      twoFactorCode,
      useBackupCode = false,
    } = body || {};

    if (!email || !password) {
      return NextResponse.json(
        { error: "이메일과 비밀번호를 입력해주세요." },
        { status: 400 }
      );
    }

    // Better Auth를 사용한 로그인
    const auth = await getAuth();
    
    // 먼저 사용자 정보를 확인
    await connectToDatabase();
    const user = await User.findOne({ email })
      .select("+suspended +cliAccess +twoFactorEnabled")
      .exec();

    if (!user) {
      return NextResponse.json(
        { error: "이메일 또는 비밀번호가 일치하지 않습니다." },
        { status: 401 }
      );
    }

    // CLI 접근 권한 확인
    if (!user.cliAccess) {
      return NextResponse.json(
        { error: "CLI 접근 권한이 없습니다." },
        { status: 403 }
      );
    }

    if (user.suspended === true) {
      return NextResponse.json(
        { error: "계정이 정지되었습니다. 관리자에게 문의하세요." },
        { status: 403 }
      );
    }

    // 2FA 확인이 필요한 경우
    if (user.twoFactorEnabled && !twoFactorCode) {
      return NextResponse.json(
        { error: "2단계 인증 코드가 필요합니다.", requiresTwoFactor: true },
        { status: 401 }
      );
    }

    // Better Auth로 로그인 시도
    try {
      const signInResult = await auth.api.signInEmail({
        body: {
          email,
          password,
        },
      });

      if (!signInResult || signInResult.error) {
        return NextResponse.json(
          { error: signInResult?.error?.message || "이메일 또는 비밀번호가 일치하지 않습니다." },
          { status: 401 }
        );
      }

      // 2FA 검증 (필요한 경우)
      if (user.twoFactorEnabled && twoFactorCode) {
        try {
          const twoFactorResult = await auth.api.verifyTOTP({
            body: {
              code: twoFactorCode,
            },
            headers: {
              cookie: `better-auth.session_token=${signInResult.token}`,
            },
          });

          if (!twoFactorResult || twoFactorResult.error) {
            return NextResponse.json(
              { error: "잘못된 인증 코드입니다.", requiresTwoFactor: true },
              { status: 401 }
            );
          }
        } catch (twoFactorError) {
          console.error("2FA 검증 오류:", twoFactorError);
          return NextResponse.json(
            { error: "잘못된 인증 코드입니다.", requiresTwoFactor: true },
            { status: 401 }
          );
        }
      }

      // CLI용 Bearer 토큰 반환
      return NextResponse.json({
        success: true,
        token: signInResult.token,
        user: {
          id: signInResult.user.id,
          email: signInResult.user.email,
          name: signInResult.user.name,
          role: user.role,
          isVerified: user.isVerified,
        },
      });
    } catch (signInError) {
      console.error("Better Auth 로그인 오류:", signInError);
      return NextResponse.json(
        { error: "이메일 또는 비밀번호가 일치하지 않습니다." },
        { status: 401 }
      );
    }
  } catch (error) {
    console.error("CLI 로그인 오류:", error);
    return NextResponse.json(
      { error: "로그인 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
