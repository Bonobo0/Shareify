import nodemailer from "nodemailer";
import crypto from "crypto";

// 이메일 전송 설정 (환경변수로 관리)
const createTransporter = () => {
  return nodemailer.createTransport({
    service: "gmail", // Gmail SMTP 사용
    auth: {
      user: process.env.EMAIL_USER, // Gmail 계정
      pass: process.env.EMAIL_PASSWORD, // Gmail 앱 비밀번호
    },
  });
};

// 인증 토큰 생성
export const generateVerificationToken = () => {
  return crypto.randomBytes(32).toString("hex");
};

// 이메일 인증 메일 전송
export const sendVerificationEmail = async (email, token, name) => {
  try {
    const transporter = createTransporter();

    const verificationUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/auth/verify-email?token=${token}`;

    const mailOptions = {
      from: `"Shareify" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`, // 사용자 정의 도메인 또는 Gmail
      to: email,
      subject: "Shareify - 이메일 인증",
      html: `
        <div style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: Arial, sans-serif;">
          <h2 style="color: #333;">Shareify 회원가입을 완료해주세요</h2>
          <p>안녕하세요${name ? ` ${name}님` : ""}!</p>
          <p>Shareify에 가입해주셔서 감사합니다. 아래 버튼을 클릭하여 이메일 인증을 완료해주세요.</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationUrl}" 
               style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
              이메일 인증하기
            </a>
          </div>
          
          <p style="color: #666; font-size: 14px;">
            이 링크는 24시간 후에 만료됩니다.<br>
            만약 버튼이 작동하지 않는다면, 아래 링크를 복사하여 브라우저에 직접 입력해주세요:
          </p>
          <p style="color: #666; font-size: 12px; word-break: break-all;">
            ${verificationUrl}
          </p>
          
          <hr style="border: 1px solid #eee; margin: 30px 0;">
          <p style="color: #999; font-size: 12px;">
            이 메일을 요청하지 않으셨다면 무시하셔도 됩니다.
          </p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (error) {
    console.error("이메일 전송 오류:", error);
    return { error: "이메일 전송에 실패했습니다." };
  }
};

// 2FA 설정 안내 메일 전송
export const send2FASetupEmail = async (email, name) => {
  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: `"Shareify" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`, // 사용자 정의 도메인 또는 Gmail
      to: email,
      subject: "Shareify - 2단계 인증이 활성화되었습니다",
      html: `
        <div style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: Arial, sans-serif;">
          <h2 style="color: #333;">2단계 인증이 활성화되었습니다</h2>
          <p>안녕하세요${name ? ` ${name}님` : ""}!</p>
          <p>귀하의 Shareify 계정에 2단계 인증이 성공적으로 활성화되었습니다.</p>
          
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p style="margin: 0; color: #495057;">
              <strong>보안 강화:</strong> 이제 로그인 시 인증 앱에서 생성된 6자리 코드가 필요합니다.
            </p>
          </div>
          
          <p style="color: #666;">
            백업 코드를 안전한 곳에 보관하시기 바랍니다. 인증 앱에 접근할 수 없는 경우 백업 코드를 사용하여 로그인할 수 있습니다.
          </p>
          
          <p style="color: #dc3545; font-weight: bold;">
            만약 이 활동을 본인이 하지 않았다면, 즉시 계정을 확인하고 비밀번호를 변경해주세요.
          </p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (error) {
    console.error("2FA 알림 메일 전송 오류:", error);
    return { error: "알림 메일 전송에 실패했습니다." };
  }
};
