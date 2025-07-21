"use server";

import { connectToDatabase } from "@/lib/db/mongodb";
import User from "@/models/User";
import { generateToken, verifyToken } from "@/lib/auth/jwt";
import { cookies } from "next/headers";
import {
  generateVerificationToken,
  sendVerificationEmail,
} from "@/lib/email/emailService";
import { verify2FAToken, verifyBackupCode } from "@/lib/auth/twoFactor";
import { checkActionRateLimit } from "@/lib/actionRateLimit";

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
      "+password +twoFactorEnabled +twoFactorSecret +twoFactorBackupCodes"
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
          user.twoFactorBackupCodes
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

    const token = await generateToken(user._id);

    // 쿠키에 토큰 저장
    cookies().set("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7일
    });

    return {
      success: true,
      message: "로그인 성공",
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
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
    if (!email || !email.includes("@")) {
      return {
        error: "유효한 이메일을 입력해주세요.",
      };
    }

    // 비밀번호 유효성 검사
    if (!password || password.length < 6) {
      return {
        error: "비밀번호는 최소 6자 이상이어야 합니다.",
      };
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
      user.name
    );

    if (emailResult.error) {
      // 사용자는 생성되었지만 이메일 전송 실패
      console.error("회원가입 후 인증 메일 전송 실패:", emailResult.error);
    }

    // 토큰 생성 및 쿠키 설정 (이메일 미인증 상태로도 로그인 허용)
    const token = await generateToken(user._id);

    cookies().set("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7일
    });

    return {
      success: true,
      message:
        "회원가입이 완료되었습니다. 이메일을 확인하여 인증을 완료해주세요.",
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        isVerified: user.isVerified,
      },
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
    // 기존 쿠키 삭제
    cookies().set("token", "", {
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

export async function verifyAuth() {
  try {
    const token = cookies().get("token")?.value;

    if (!token) {
      return { authenticated: false };
    }

    const decoded = await verifyToken(token);
    if (!decoded) {
      return { authenticated: false };
    }

    await connectToDatabase();
    const user = await User.findById(decoded.userId).select("-password");

    if (!user) {
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

    if (newPassword.length < 8) {
      return { error: "비밀번호는 최소 8자 이상이어야 합니다." };
    }

    await connectToDatabase();

    // 토큰으로 사용자 조회 (만료되지 않은 토큰만)
    const user = await User.findOne({
      passwordResetToken: token,
      passwordResetExpires: { $gt: new Date() },
    }).select(
      "+password +twoFactorEnabled +twoFactorSecret +twoFactorBackupCodes"
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
        const backupCodeResult = await verifyBackupCode(
          user._id.toString(),
          twoFactorCode
        );
        if (!backupCodeResult.success) {
          return { error: backupCodeResult.error };
        }
        is2FAValid = true;
      } else {
        // TOTP 코드 확인
        const totpResult = await verify2FAToken(
          user.twoFactorSecret,
          twoFactorCode
        );
        if (!totpResult.success) {
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
    const token = cookies().get("token")?.value;
    if (!token) {
      return { error: "로그인이 필요합니다." };
    }

    const decoded = await verifyToken(token);
    if (!decoded) {
      return { error: "유효하지 않은 토큰입니다." };
    }

    if (!currentPassword || !newPassword || !confirmPassword) {
      return { error: "모든 필드를 입력해주세요." };
    }

    if (newPassword !== confirmPassword) {
      return { error: "새 비밀번호가 일치하지 않습니다." };
    }

    if (newPassword.length < 8) {
      return { error: "새 비밀번호는 최소 8자 이상이어야 합니다." };
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
