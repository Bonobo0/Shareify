import speakeasy from "speakeasy";
import QRCode from "qrcode";
import crypto from "crypto";

// 2FA 시크릿 생성
export const generate2FASecret = (email, serviceName = "Shareify") => {
  const secret = speakeasy.generateSecret({
    name: email,
    service: serviceName,
    length: 32,
  });

  return {
    secret: secret.base32,
    otpauth_url: secret.otpauth_url,
  };
};

// QR 코드 생성
export const generateQRCode = async (otpauth_url) => {
  try {
    const qrCodeDataURL = await QRCode.toDataURL(otpauth_url);
    return { success: true, qrCode: qrCodeDataURL };
  } catch (error) {
    console.error("QR 코드 생성 오류:", error);
    return { error: "QR 코드 생성에 실패했습니다." };
  }
};

// 2FA 토큰 검증
export const verify2FAToken = (token, secret) => {
  try {
    const verified = speakeasy.totp.verify({
      secret: secret,
      encoding: "base32",
      token: token,
      window: 2, // 30초 * 2 = 60초 허용 오차
    });

    return verified;
  } catch (error) {
    console.error("2FA 토큰 검증 오류:", error);
    return false;
  }
};

// 백업 코드 생성 (8개)
export const generateBackupCodes = () => {
  const codes = [];
  for (let i = 0; i < 8; i++) {
    // 8자리 백업 코드 생성
    const code = crypto.randomBytes(4).toString("hex").toUpperCase();
    codes.push({
      code: `${code.slice(0, 4)}-${code.slice(4)}`,
      used: false,
    });
  }
  return codes;
};

// 백업 코드 검증
export const verifyBackupCode = (inputCode, backupCodes) => {
  const normalizedInput = inputCode.replace(/[\s-]/g, "").toUpperCase();

  for (let i = 0; i < backupCodes.length; i++) {
    const storedCode = backupCodes[i].code.replace(/[\s-]/g, "").toUpperCase();

    if (normalizedInput === storedCode && !backupCodes[i].used) {
      return { valid: true, index: i };
    }
  }

  return { valid: false, index: -1 };
};
