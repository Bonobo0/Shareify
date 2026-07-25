import { checkRateLimit } from "@/lib/redis/rateLimiter";
import { headers } from "next/headers";

/**
 * Server Action에서 Redis 기반 rate limiting 체크
 * @param {string} action - 액션 이름 (예: 'signup', 'signin', 'download', 'file-operation')
 * @param {string} identifier - 식별자 (IP 주소나 사용자 이메일)
 * @returns {Promise<{allowed: boolean, error?: string, retryAfter?: number}>}
 */
export async function checkActionRateLimit(action, identifier = null) {
  try {
    // IP 주소 가져오기
    let clientIP = identifier;
    if (!clientIP) {
      const headersList = await headers();
      const forwarded = headersList.get("x-forwarded-for");
      const realIP = headersList.get("x-real-ip");
      const cloudflareIP = headersList.get("cf-connecting-ip");

      if (cloudflareIP) clientIP = cloudflareIP;
      else if (realIP) clientIP = realIP;
      else if (forwarded) clientIP = forwarded.split(",")[0].trim();
      else clientIP = "127.0.0.1";
    }

    const result = await checkRateLimit(clientIP, action);

    if (!result.allowed) {
      console.log(`Rate limit exceeded for ${clientIP} on ${action}`);

      const messages = {
        signup: "회원가입 시도가 너무 많습니다. ",
        signin: "로그인 시도가 너무 많습니다. ",
        "forgot-password": "비밀번호 재설정 요청이 너무 많습니다. ",
        "reset-password": "비밀번호 재설정 시도가 너무 많습니다. ",
        upload: "파일 업로드 요청이 너무 많습니다. ",
        share: "공유 요청이 너무 많습니다. ",
        download: "파일 다운로드 요청이 너무 많습니다. ",
        "file-operation": "파일 작업 요청이 너무 많습니다. ",
      };
      let message = messages[action] || "요청이 너무 많습니다. ";

      // 재시도 가능 시간을 사람이 읽기 쉬운 형태로 변환
      if (result.retryAfter) {
        if (result.retryAfter < 60) {
          message += `${result.retryAfter}초`;
        } else if (result.retryAfter < 3600) {
          message += `${Math.ceil(result.retryAfter / 60)}분`;
        } else {
          message += `${Math.ceil(result.retryAfter / 3600)}시간`;
        }
        message += " 후에 다시 시도해주세요.";
      }

      return {
        allowed: false,
        error: message,
        retryAfter: result.retryAfter,
      };
    }

    return {
      allowed: true,
      remaining: result.remaining,
      resetTime: result.resetTime,
    };
  } catch (error) {
    console.error("Rate limit check error:", error);
    // Redis 장애 시 fail-closed (요청 차단)
    return { allowed: false, error: "요청을 처리할 수 없습니다. 잠시 후 다시 시도해주세요." };
  }
}