"use server";

import { connectToDatabase } from "@/lib/db/mongodb";
import { requireAuthenticatedUser } from "@/lib/auth/serverAuth";
import User from "@/models/User";
import {
  generateVerificationToken,
  sendVerificationEmail,
  send2FASetupEmail,
} from "@/lib/email/emailService";
import {
  generate2FASecret,
  generateQRCode,
  verify2FAToken,
  generateBackupCodes,
  verifyBackupCode,
} from "@/lib/auth/twoFactor";
import { isHexToken } from "@/lib/security/tokens.mjs";


// 이메일 인증 토큰 전송
export async function sendEmailVerification() {
  try {
    const userId = await requireAuthenticatedUser();
    if (!userId) {
      return { error: "인증이 필요합니다." };
    }

    await connectToDatabase();
    const user = await User.findById(userId);

    if (!user) {
      return { error: "사용자를 찾을 수 없습니다." };
    }

    if (user.isVerified) {
      return { error: "이미 인증된 사용자입니다." };
    }

    // 인증 토큰 생성
    const token = generateVerificationToken();
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24시간

    // 사용자 정보 업데이트
    user.emailVerificationToken = token;
    user.emailVerificationExpires = expires;
    await user.save();

    // 인증 메일 전송
    const emailResult = await sendVerificationEmail(
      user.email,
      token,
      user.name
    );

    if (emailResult.error) {
      return { error: emailResult.error };
    }

    return { success: true, message: "인증 메일이 전송되었습니다." };
  } catch (error) {
    console.error("이메일 인증 전송 오류:", error);
    return { error: "인증 메일 전송에 실패했습니다." };
  }
}

// 이메일 인증 확인
export async function verifyEmail(input = {}) {
  try {
    const token = input?.token;
    if (!isHexToken(token)) {
      return { error: "유효하지 않거나 만료된 인증 토큰입니다." };
    }

    await connectToDatabase();

    const user = await User.findOne({
      emailVerificationToken: token,
      emailVerificationExpires: { $gt: new Date() },
    }).select("+emailVerificationToken +emailVerificationExpires");

    if (!user) {
      return { error: "유효하지 않거나 만료된 인증 토큰입니다." };
    }

    // 이메일 인증 완료
    user.isVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    return { success: true, message: "이메일 인증이 완료되었습니다." };
  } catch (error) {
    console.error("이메일 인증 확인 오류:", error);
    return { error: "이메일 인증 처리 중 오류가 발생했습니다." };
  }
}

// 2FA 설정 시작
export async function setup2FA() {
  try {
    const userId = await requireAuthenticatedUser();
    if (!userId) {
      return { error: "인증이 필요합니다." };
    }

    await connectToDatabase();
    const user = await User.findById(userId);

    if (!user) {
      return { error: "사용자를 찾을 수 없습니다." };
    }

    if (!user.isVerified) {
      return { error: "이메일 인증을 먼저 완료해주세요." };
    }

    if (user.twoFactorEnabled) {
      return { error: "이미 2단계 인증이 활성화되어 있습니다." };
    }

    // 2FA 시크릿 생성
    const { secret, otpauth_url } = generate2FASecret(user.email);

    // QR 코드 생성
    const qrResult = await generateQRCode(otpauth_url);
    if (qrResult.error) {
      return { error: qrResult.error };
    }

    return {
      success: true,
      secret,
      qrCode: qrResult.qrCode,
      message: "QR 코드를 스캔하고 인증 코드를 입력해주세요.",
    };
  } catch (error) {
    console.error("2FA 설정 시작 오류:", error);
    return { error: "2FA 설정을 시작할 수 없습니다." };
  }
}

// 2FA 활성화 (인증 코드 확인)
export async function enable2FA({ token, secret }) {
  try {
    const userId = await requireAuthenticatedUser();
    if (!userId) {
      return { error: "인증이 필요합니다." };
    }

    // 토큰 검증
    const isValid = verify2FAToken(token, secret);
    if (!isValid) {
      return { error: "잘못된 인증 코드입니다." };
    }

    await connectToDatabase();
    const user = await User.findById(userId);

    if (!user) {
      return { error: "사용자를 찾을 수 없습니다." };
    }

    if (user.twoFactorEnabled) {
      return { error: "이미 2단계 인증이 활성화되어 있습니다." };
    }

    // 백업 코드 생성
    const backupCodes = generateBackupCodes();

    // 2FA 활성화
    user.twoFactorEnabled = true;
    user.twoFactorSecret = secret;
    user.twoFactorBackupCodes = backupCodes;
    await user.save();

    // 알림 메일 전송
    await send2FASetupEmail(user.email, user.name);

    return {
      success: true,
      message: "2단계 인증이 활성화되었습니다.",
      backupCodes: backupCodes.map((bc) => bc.code),
    };
  } catch (error) {
    console.error("2FA 활성화 오류:", error);
    return { error: "2FA 활성화에 실패했습니다." };
  }
}

// 2FA 비활성화
export async function disable2FA({ password }) {
  try {
    const userId = await requireAuthenticatedUser();
    if (!userId) {
      return { error: "인증이 필요합니다." };
    }

    await connectToDatabase();
    const user = await User.findById(userId).select("+password");

    if (!user) {
      return { error: "사용자를 찾을 수 없습니다." };
    }

    // 비밀번호 확인
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return { error: "비밀번호가 일치하지 않습니다." };
    }

    // 2FA 비활성화
    user.twoFactorEnabled = false;
    user.twoFactorSecret = undefined;
    user.twoFactorBackupCodes = [];
    await user.save();

    return {
      success: true,
      message: "2단계 인증이 비활성화되었습니다.",
    };
  } catch (error) {
    console.error("2FA 비활성화 오류:", error);
    return { error: "2FA 비활성화에 실패했습니다." };
  }
}

// 2FA 토큰 검증 (로그인 시 사용)
export async function verify2FA({ email, token, isBackupCode = false }) {
  try {
    await connectToDatabase();

    const user = await User.findOne({ email }).select(
      "+twoFactorSecret +twoFactorBackupCodes"
    );

    if (!user || !user.twoFactorEnabled) {
      return { error: "2단계 인증이 설정되지 않았습니다." };
    }

    let isValid = false;

    if (isBackupCode) {
      // 백업 코드 검증
      const backupResult = verifyBackupCode(token, user.twoFactorBackupCodes);
      if (backupResult.valid) {
        // 사용된 백업 코드 표시
        user.twoFactorBackupCodes[backupResult.index].used = true;
        await user.save();
        isValid = true;
      }
    } else {
      // 일반 토큰 검증
      isValid = verify2FAToken(token, user.twoFactorSecret);
    }

    if (!isValid) {
      return { error: "잘못된 인증 코드입니다." };
    }

    return { success: true, message: "인증이 완료되었습니다." };
  } catch (error) {
    console.error("2FA 검증 오류:", error);
    return { error: "인증 처리 중 오류가 발생했습니다." };
  }
}
