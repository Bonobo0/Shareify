import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/mongodb";
import User from "@/models/User";
import { generateTokenPair } from "@/lib/auth/jwt";
import { verify2FAToken, verifyBackupCode } from "@/lib/auth/twoFactor";
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

    await connectToDatabase();

    const user = await User.findOne({ email })
      .select(
        "+password +twoFactorEnabled +twoFactorSecret +twoFactorBackupCodes +suspended"
      )
      .exec();

    if (!user) {
      return NextResponse.json(
        { error: "이메일 또는 비밀번호가 일치하지 않습니다." },
        { status: 401 }
      );
    }

    const passwordMatches = await user.comparePassword(password);
    if (!passwordMatches) {
      return NextResponse.json(
        { error: "이메일 또는 비밀번호가 일치하지 않습니다." },
        { status: 401 }
      );
    }

    if (user.suspended === true) {
      return NextResponse.json(
        { error: "계정이 정지되었습니다. 관리자에게 문의하세요." },
        { status: 403 }
      );
    }

    if (user.twoFactorEnabled) {
      if (!twoFactorCode) {
        return NextResponse.json(
          { error: "2단계 인증 코드가 필요합니다.", requiresTwoFactor: true },
          { status: 401 }
        );
      }

      let twoFactorValid = false;

      if (useBackupCode) {
        const backupResult = verifyBackupCode(
          twoFactorCode,
          user.twoFactorBackupCodes || []
        );

        if (backupResult.valid) {
          user.twoFactorBackupCodes[backupResult.index].used = true;
          await user.save();
          twoFactorValid = true;
        }
      } else {
        twoFactorValid = verify2FAToken(twoFactorCode, user.twoFactorSecret);
      }

      if (!twoFactorValid) {
        return NextResponse.json(
          { error: "잘못된 인증 코드입니다.", requiresTwoFactor: true },
          { status: 401 }
        );
      }
    }

    const userAgent = request.headers.get("user-agent") || "Unknown";
    const forwardedFor = request.headers.get("x-forwarded-for");
    const realIp = request.headers.get("x-real-ip");
    const ip = (forwardedFor?.split(",")[0] || realIp || "Unknown").trim();
    const nowIso = new Date().toISOString();

    const { accessToken, refreshToken } = await generateTokenPair(user._id, {
      userAgent,
      ip,
      createdAt: nowIso,
      lastUsedAt: nowIso,
    });

    return NextResponse.json({
      success: true,
      accessToken,
      refreshToken,
      // 하위 호환성을 위해 token 필드도 유지 (deprecated)
      token: accessToken,
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        role: user.role,
        isVerified: user.isVerified,
      },
    });
  } catch (error) {
    console.error("CLI 로그인 오류:", error);
    return NextResponse.json(
      { error: "로그인 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
