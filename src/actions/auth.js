"use server";

import { connectToDatabase } from "@/lib/db/mongodb";
import User from "@/models/User";
import {
  generateTokenPair,
  verifyToken,
  verifyAccessToken,
  rotateRefreshToken,
} from "@/lib/auth/jwt";
import {
  invalidateRefreshToken,
  invalidateAllUserRefreshTokens,
  invalidateAllUserRefreshTokensExcept,
  listUserRefreshTokenSessions,
} from "@/lib/redis/client";
import { cookies, headers } from "next/headers";
import {
  generateVerificationToken,
  sendVerificationEmail,
} from "@/lib/email/emailService";
import { verify2FAToken, verifyBackupCode } from "@/lib/auth/twoFactor";
import { checkActionRateLimit } from "@/lib/actionRateLimit";
import { validatePassword, validateEmail } from "@/lib/validation";

// Cookie configuration
const ACCESS_TOKEN_MAX_AGE = 15 * 60; // 15분
const REFRESH_TOKEN_MAX_AGE = 7 * 24 * 60 * 60; // 7일

async function buildSessionData() {
  const headerStore = await headers();
  const userAgent = headerStore.get("user-agent") || "Unknown";
  const forwardedFor = headerStore.get("x-forwarded-for");
  const realIp = headerStore.get("x-real-ip");
  const ip = (forwardedFor?.split(",")[0] || realIp || "Unknown").trim();
  const nowIso = new Date().toISOString();

  return {
    userAgent,
    ip,
    createdAt: nowIso,
    lastUsedAt: nowIso,
  };
}

export async function signIn(formData) {
  try {
    // Rate limiting 체크
    const rateLimitResult = await checkActionRateLimit("signin");
    if (!rateLimitResult.allowed) {
      return {
        error: rateLimitResult.error,
      };
    }

    await connectToDatabase();

    const email = formData.get("email");
    const password = formData.get("password");
    const twoFactorCode = formData.get("twoFactorCode");
    const isBackupCode = formData.get("isBackupCode") === "true";

    if (!email || !password) {
      return {
        error: "이메일과 비밀번호를 입력해주세요.",
      };
    }

    const user = await User.findOne({ email }).select(
      "+password +twoFactorEnabled +twoFactorSecret +twoFactorBackupCodes",
    );

    if (!user) {
      return {
        error: "이메일 또는 비밀번호가 일치하지 않습니다.",
      };
    }

    console.log("User found:", {
      id: user._id,
      email: user.email,
      hasPassword: !!user.password,
      twoFactorEnabled: user.twoFactorEnabled,
    });

    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      return {
        error: "이메일 또는 비밀번호가 일치하지 않습니다.",
      };
    }

    // 계정 정지 상태 확인 (suspended 필드가 없는 기존 사용자는 false로 처리)
    if (user.suspended === true) {
      return {
        error: "계정이 정지되었습니다. 관리자에게 문의하세요.",
      };
    }

    // 2FA가 활성화된 경우
    if (user.twoFactorEnabled) {
      if (!twoFactorCode) {
        return {
          error: "2단계 인증 코드가 필요합니다.",
          requiresTwoFactor: true,
        };
      }

      let isValidTwoFactor = false;

      if (isBackupCode) {
        // 백업 코드 검증
        const backupResult = verifyBackupCode(
          twoFactorCode,
          user.twoFactorBackupCodes,
        );
        if (backupResult.valid) {
          // 사용된 백업 코드 표시
          user.twoFactorBackupCodes[backupResult.index].used = true;
          await user.save();
          isValidTwoFactor = true;
        }
      } else {
        // 일반 2FA 토큰 검증
        isValidTwoFactor = verify2FAToken(twoFactorCode, user.twoFactorSecret);
      }

      if (!isValidTwoFactor) {
        return {
          error: "잘못된 인증 코드입니다.",
          requiresTwoFactor: true,
        };
      }
    }

    const sessionData = await buildSessionData();
    const { accessToken, refreshToken } = await generateTokenPair(
      user._id,
      sessionData,
    );
    const cookieStore = await cookies();

    // Access token 쿠키 설정
    cookieStore.set("access_token", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: ACCESS_TOKEN_MAX_AGE,
    });

    // Refresh token 쿠키 설정
    cookieStore.set("refresh_token", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: REFRESH_TOKEN_MAX_AGE,
    });

    return {
      success: true,
      message: "로그인 성공",
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        role: user.role,
      },
    };
  } catch (error) {
    console.error("로그인 에러:", error);
    return {
      error: "로그인 중 오류가 발생했습니다.",
    };
  }
}

export async function signUp(formData) {
  try {
    // Rate limiting 체크
    const rateLimitResult = await checkActionRateLimit("signup");
    if (!rateLimitResult.allowed) {
      return {
        error: rateLimitResult.error,
      };
    }

    await connectToDatabase();

    const email = formData.get("email");
    const password = formData.get("password");
    const name = formData.get("name");

    // 이메일 유효성 검사
    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      return { error: emailValidation.error };
    }

    // 비밀번호 유효성 검사
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return { error: passwordValidation.error };
    }

    // 이미 가입된 이메일인지 확인
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return {
        error: "이미 사용 중인 이메일입니다.",
      };
    }

    // 이메일 인증 토큰 생성
    const verificationToken = generateVerificationToken();
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24시간

    // 새 사용자 생성
    const user = new User({
      email,
      password,
      name: name || email.split("@")[0],
      emailVerificationToken: verificationToken,
      emailVerificationExpires: verificationExpires,
      isVerified: false, // 이메일 인증 필요
    });

    await user.save();

    console.log("회원가입 완료:", {
      id: user._id,
      email: user.email,
      isVerified: user.isVerified,
    });

    // 인증 메일 전송
    const emailResult = await sendVerificationEmail(
      email,
      verificationToken,
      user.name,
    );

    if (emailResult.error) {
      // 사용자는 생성되었지만 이메일 전송 실패
      console.error("회원가입 후 인증 메일 전송 실패:", emailResult.error);
    }

    // 이메일 인증 전에는 토큰을 발급하지 않음 (사용자가 직접 signIn 통해 로그인해야 함)
    return {
      success: true,
      message:
        "회원가입이 완료되었습니다. 이메일을 확인하여 인증을 완료한 후 로그인해주세요.",
      emailSent: !emailResult.error,
    };
  } catch (error) {
    console.error("회원가입 에러:", error);
    return {
      error: "회원가입 중 오류가 발생했습니다.",
    };
  }
}

export async function signOut() {
  try {
    // Refresh token 가져와서 Redis에서 무효화
    const cookieStore = await cookies();
    const refreshToken = cookieStore.get("refresh_token")?.value;
    if (refreshToken) {
      const payload = await verifyToken(refreshToken);
      if (payload && payload.jti) {
        await invalidateRefreshToken(payload.userId, payload.jti);
      }
    }

    // Access token 쿠키 삭제
    cookieStore.set("access_token", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 0,
      expires: new Date(0),
    });

    // Refresh token 쿠키 삭제
    cookieStore.set("refresh_token", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 0,
      expires: new Date(0),
    });

    return { success: true };
  } catch (error) {
    console.error("로그아웃 에러:", error);
    return {
      success: false,
      error: "로그아웃 중 오류가 발생했습니다.",
    };
  }
}

/**
 * Refresh access token using refresh token (RTR - Refresh Token Rotation)
 * Server Action for token refresh - replaces the old /api/auth/refresh API route
 *
 * This function:
 * 1. Validates the current refresh token from cookie
 * 2. Invalidates the old refresh token in Redis
 * 3. Generates a new access token + refresh token pair
 * 4. Sets both tokens as HttpOnly cookies
 *
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function refreshTokens() {
  try {
    // Get refresh token from cookie
    const cookieStore = await cookies();
    const refreshToken = cookieStore.get("refresh_token")?.value;

    if (!refreshToken) {
      return {
        success: false,
        error: "Refresh token이 없습니다.",
      };
    }

    // Rotate refresh token (RTR)
    const tokenPair = await rotateRefreshToken(refreshToken);

    if (!tokenPair) {
      return {
        success: false,
        error: "유효하지 않거나 만료된 refresh token입니다.",
      };
    }

    // Set new access token cookie
    cookieStore.set("access_token", tokenPair.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: ACCESS_TOKEN_MAX_AGE,
    });

    // Set new refresh token cookie
    cookieStore.set("refresh_token", tokenPair.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: REFRESH_TOKEN_MAX_AGE,
    });

    return {
      success: true,
      message: "토큰이 갱신되었습니다.",
    };
  } catch (error) {
    console.error("Token refresh error:", error);
    return {
      success: false,
      error: "토큰 갱신 중 오류가 발생했습니다.",
    };
  }
}

export async function revokeOtherSessions() {
  try {
    const cookieStore = await cookies();
    const refreshToken = cookieStore.get("refresh_token")?.value;

    if (!refreshToken) {
      return { error: "Refresh token이 없습니다." };
    }

    const payload = await verifyToken(refreshToken);
    if (!payload?.userId || !payload?.jti) {
      return { error: "유효하지 않은 refresh token입니다." };
    }

    await invalidateAllUserRefreshTokensExcept(payload.userId, payload.jti);

    return {
      success: true,
      message: "다른 기기 세션이 모두 로그아웃되었습니다.",
    };
  } catch (error) {
    console.error("Revoke other sessions error:", error);
    return { error: "다른 세션 로그아웃 중 오류가 발생했습니다." };
  }
}

export async function revokeAllSessions() {
  try {
    const cookieStore = await cookies();
    const refreshToken = cookieStore.get("refresh_token")?.value;

    if (!refreshToken) {
      return { error: "Refresh token이 없습니다." };
    }

    const payload = await verifyToken(refreshToken);
    if (!payload?.userId) {
      return { error: "유효하지 않은 refresh token입니다." };
    }

    await invalidateAllUserRefreshTokens(payload.userId);

    cookieStore.set("access_token", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 0,
      expires: new Date(0),
    });

    cookieStore.set("refresh_token", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 0,
      expires: new Date(0),
    });

    return {
      success: true,
      message: "모든 세션이 로그아웃되었습니다.",
      loggedOut: true,
    };
  } catch (error) {
    console.error("Revoke all sessions error:", error);
    return { error: "전체 세션 로그아웃 중 오류가 발생했습니다." };
  }
}

export async function listSessions() {
  try {
    const cookieStore = await cookies();
    const refreshToken = cookieStore.get("refresh_token")?.value;

    if (!refreshToken) {
      return { error: "Refresh token이 없습니다." };
    }

    const payload = await verifyToken(refreshToken);
    if (!payload?.userId) {
      return { error: "유효하지 않은 refresh token입니다." };
    }

    const sessions = await listUserRefreshTokenSessions(payload.userId);

    return {
      success: true,
      sessions,
      currentJti: payload.jti || null,
    };
  } catch (error) {
    console.error("List sessions error:", error);
    return { error: "세션 목록 조회 중 오류가 발생했습니다." };
  }
}

export async function revokeSessionByJti({ jti }) {
  try {
    if (!jti) {
      return { error: "세션 ID가 필요합니다." };
    }

    const cookieStore = await cookies();
    const refreshToken = cookieStore.get("refresh_token")?.value;

    if (!refreshToken) {
      return { error: "Refresh token이 없습니다." };
    }

    const payload = await verifyToken(refreshToken);
    if (!payload?.userId) {
      return { error: "유효하지 않은 refresh token입니다." };
    }

    await invalidateRefreshToken(payload.userId, jti);

    if (payload.jti === jti) {
      cookieStore.set("access_token", "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 0,
        expires: new Date(0),
      });

      cookieStore.set("refresh_token", "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 0,
        expires: new Date(0),
      });

      return {
        success: true,
        message: "현재 세션이 로그아웃되었습니다.",
        loggedOut: true,
      };
    }

    return {
      success: true,
      message: "선택한 세션이 로그아웃되었습니다.",
    };
  } catch (error) {
    console.error("Revoke session by jti error:", error);
    return { error: "세션 로그아웃 중 오류가 발생했습니다." };
  }
}

export async function verifyAuth() {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get("access_token")?.value;

    if (!accessToken) {
      return { authenticated: false };
    }

    const decoded = await verifyAccessToken(accessToken);
    if (!decoded) {
      return { authenticated: false };
    }

    await connectToDatabase();
    const user = await User.findById(decoded.userId).select("-password");

    if (!user) {
      return { authenticated: false };
    }

    // 계정 정지 상태 확인 (suspended 필드가 없는 기존 사용자는 false로 처리)
    if (user.suspended === true) {
      return { authenticated: false };
    }

    return {
      authenticated: true,
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        isVerified: user.isVerified,
        twoFactorEnabled: user.twoFactorEnabled,
        role: user.role,
      },
    };
  } catch (error) {
    console.error("인증 확인 에러:", error);
    return { authenticated: false };
  }
}

// 비밀번호 재설정 요청
export async function requestPasswordReset({ email }) {
  try {
    // Rate limiting 체크
    const rateLimitResult = await checkActionRateLimit("forgot-password");
    if (!rateLimitResult.allowed) {
      return {
        error: rateLimitResult.error,
      };
    }

    if (!email) {
      return { error: "이메일을 입력해주세요." };
    }

    await connectToDatabase();

    // 사용자 조회
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      // 보안상 사용자가 존재하지 않더라도 성공 메시지 반환
      return {
        success: true,
        message: "비밀번호 재설정 링크가 이메일로 전송되었습니다.",
      };
    }

    // 재설정 토큰 생성 (랜덤 32바이트 hex 문자열)
    const crypto = await import("crypto");
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15분 후 만료

    // 사용자에 토큰 저장
    user.passwordResetToken = resetToken;
    user.passwordResetExpires = resetTokenExpiry;
    await user.save();

    // 이메일 발송
    const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/user/reset-password?token=${resetToken}`;

    const { sendPasswordResetEmail } = await import("@/lib/email/emailService");
    const emailResult = await sendPasswordResetEmail({
      to: user.email,
      name: user.name || user.email,
      resetUrl,
    });

    if (emailResult.error) {
      console.error("Password reset email failed:", emailResult.error);
      return {
        error: "이메일 발송에 실패했습니다. 잠시 후 다시 시도해주세요.",
      };
    }

    return {
      success: true,
      message: "비밀번호 재설정 링크가 이메일로 전송되었습니다.",
    };
  } catch (error) {
    console.error("Password reset request error:", error);
    return { error: "비밀번호 재설정 요청 중 오류가 발생했습니다." };
  }
}

// 비밀번호 재설정 토큰 확인
export async function verifyPasswordResetToken({ token }) {
  try {
    if (!token) {
      return { error: "재설정 토큰이 필요합니다." };
    }

    await connectToDatabase();

    // 토큰으로 사용자 조회 (만료되지 않은 토큰만)
    const user = await User.findOne({
      passwordResetToken: token,
      passwordResetExpires: { $gt: new Date() },
    }).select("+twoFactorEnabled");

    if (!user) {
      return { error: "유효하지 않거나 만료된 재설정 링크입니다." };
    }

    return {
      success: true,
      email: user.email,
      name: user.name,
      twoFactorEnabled: user.twoFactorEnabled,
    };
  } catch (error) {
    console.error("Password reset token verification error:", error);
    return { error: "토큰 확인 중 오류가 발생했습니다." };
  }
}

// 비밀번호 재설정 실행
export async function resetPassword({
  token,
  newPassword,
  confirmPassword,
  twoFactorCode,
  isBackupCode = false,
}) {
  try {
    // Rate limiting 체크
    const rateLimitResult = await checkActionRateLimit("reset-password");
    if (!rateLimitResult.allowed) {
      return {
        error: rateLimitResult.error,
      };
    }

    if (!token) {
      return { error: "재설정 토큰이 필요합니다." };
    }

    if (!newPassword || !confirmPassword) {
      return { error: "새 비밀번호를 입력해주세요." };
    }

    if (newPassword !== confirmPassword) {
      return { error: "비밀번호가 일치하지 않습니다." };
    }

    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.valid) {
      return { error: passwordValidation.error };
    }

    await connectToDatabase();

    // 토큰으로 사용자 조회 (만료되지 않은 토큰만)
    const user = await User.findOne({
      passwordResetToken: token,
      passwordResetExpires: { $gt: new Date() },
    }).select(
      "+password +twoFactorEnabled +twoFactorSecret +twoFactorBackupCodes",
    );

    if (!user) {
      return { error: "유효하지 않거나 만료된 재설정 링크입니다." };
    }

    // 2FA가 활성화된 경우 2FA 코드 확인
    if (user.twoFactorEnabled) {
      if (!twoFactorCode) {
        return {
          error: "2FA 인증이 활성화된 계정입니다. 인증 코드를 입력해주세요.",
          requires2FA: true,
        };
      }

      let is2FAValid = false;

      if (isBackupCode) {
        // 백업 코드 확인
        const backupCodeResult = verifyBackupCode(
          twoFactorCode,
          user.twoFactorBackupCodes,
        );
        if (!backupCodeResult.valid) {
          return { error: "유효하지 않은 백업 코드입니다." };
        }
        // 사용된 백업 코드 표시
        user.twoFactorBackupCodes[backupCodeResult.index].used = true;
        is2FAValid = true;
      } else {
        // TOTP 코드 확인
        const totpResult = verify2FAToken(
          twoFactorCode,
          user.twoFactorSecret,
        );
        if (!totpResult) {
          return { error: "유효하지 않은 2FA 인증 코드입니다." };
        }
        is2FAValid = true;
      }

      if (!is2FAValid) {
        return { error: "2FA 인증에 실패했습니다." };
      }
    }

    // 새 비밀번호 설정
    user.password = newPassword;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    user.updatedAt = new Date();

    await user.save();

    return {
      success: true,
      message: "비밀번호가 성공적으로 변경되었습니다.",
    };
  } catch (error) {
    console.error("Password reset error:", error);
    return { error: "비밀번호 재설정 중 오류가 발생했습니다." };
  }
}

// 로그인한 사용자의 비밀번호 변경
export async function changePassword({
  currentPassword,
  newPassword,
  confirmPassword,
}) {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get("access_token")?.value;
    if (!accessToken) {
      return { error: "로그인이 필요합니다." };
    }

    const decoded = await verifyAccessToken(accessToken);
    if (!decoded) {
      return { error: "유효하지 않은 토큰입니다." };
    }

    if (!currentPassword || !newPassword || !confirmPassword) {
      return { error: "모든 필드를 입력해주세요." };
    }

    if (newPassword !== confirmPassword) {
      return { error: "새 비밀번호가 일치하지 않습니다." };
    }

    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.valid) {
      return { error: passwordValidation.error };
    }

    await connectToDatabase();

    // 사용자 조회 (비밀번호 포함)
    const user = await User.findById(decoded.userId).select("+password");
    if (!user) {
      return { error: "사용자를 찾을 수 없습니다." };
    }

    // 현재 비밀번호 확인
    const isCurrentPasswordValid = await user.comparePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      return { error: "현재 비밀번호가 올바르지 않습니다." };
    }

    // 새 비밀번호 설정
    user.password = newPassword;
    user.updatedAt = new Date();
    await user.save();

    return {
      success: true,
      message: "비밀번호가 성공적으로 변경되었습니다.",
    };
  } catch (error) {
    console.error("Password change error:", error);
    return { error: "비밀번호 변경 중 오류가 발생했습니다." };
  }
}
