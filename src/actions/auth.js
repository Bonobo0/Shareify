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

export async function signIn(formData) {
  try {
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
