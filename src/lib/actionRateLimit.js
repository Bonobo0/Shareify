import dbRateLimiter from "@/lib/dbRateLimiter";
import { headers } from "next/headers";

/**
 * Server Action에서 rate limiting 체크
 * @param {string} action - 액션 이름 (예: 'signup', 'signin')
 * @param {string} identifier - 식별자 (IP 주소나 사용자 이메일)
 * @returns {Promise<{allowed: boolean, error?: string, retryAfter?: number}>}
 */
export async function checkActionRateLimit(action, identifier = null) {
  try {
    // IP 주소 가져오기
    let clientIP = identifier;
    if (!clientIP) {
      const headersList = headers();
      const forwarded = headersList.get("x-forwarded-for");
      const realIP = headersList.get("x-real-ip");
      const cloudflareIP = headersList.get("cf-connecting-ip");

      if (cloudflareIP) clientIP = cloudflareIP;
      else if (realIP) clientIP = realIP;
      else if (forwarded) clientIP = forwarded.split(",")[0].trim();
      else clientIP = "127.0.0.1";
    }

    const result = await dbRateLimiter.checkLimit(clientIP, action);

    if (!result.allowed) {
      console.log(`Rate limit exceeded for ${clientIP} on ${action}`);

      let message = "요청이 너무 많습니다.  ";

      if (action === "signup") {
        message = "회원가입 시도가 너무 많습니다.  ";
      } else if (action === "signin") {
        message = "로그인 시도가 너무 많습니다.  ";
      } else if (action === "forgot-password") {
        message = "비밀번호 재설정 요청이 너무 많습니다.  ";
      } else if (action === "reset-password") {
        message = "비밀번호 재설정 시도가 너무 많습니다.  ";
      } else if (action === "upload") {
        message = "파일 업로드 요청이 너무 많습니다.  ";
      } else if (action === "share") {
        message = "공유 요청이 너무 많습니다.  ";
      }

      // 재시도 가능 시간을 사람이 읽기 쉬운 형태로 변환
      let retryMessage = "";
      if (result.retryAfter) {
        if (result.retryAfter < 60) {
          retryMessage = ` ${result.retryAfter}초`;
        } else if (result.retryAfter < 3600) {
          retryMessage = ` ${Math.ceil(result.retryAfter / 60)}분`;
        } else {
          retryMessage = ` ${Math.ceil(result.retryAfter / 3600)}시간`;
        }
        message += retryMessage + " 후에 다시 시도해주세요.";
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
    // 에러 발생 시 요청 허용 (fail-open)
    return { allowed: true };
  }
}

/**
 * 특정 사용자의 rate limit 초기화 (관리자용)
 * @param {string} action - 액션 이름
 * @param {string} identifier - 식별자
 */
export async function resetActionRateLimit(action, identifier) {
  return await dbRateLimiter.reset(identifier, action);
}

/**
 * Rate limit 통계 조회 (관리자용)
 * @param {string} action - 액션 이름 (선택적)
 * @param {string} identifier - 식별자 (선택적)
 */
export async function getActionRateLimitStats(
  action = null,
  identifier = null
) {
  return await dbRateLimiter.getStats(identifier, action);
}
