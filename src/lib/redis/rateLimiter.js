import { getRedisClient } from "@/lib/redis/client";

// 액션별 제한 설정
const LIMITS = {
  signup: { max: 3, windowMs: 60 * 60 * 1000 },
  signin: { max: 10, windowMs: 15 * 60 * 1000 },
  "forgot-password": { max: 3, windowMs: 60 * 60 * 1000 },
  "reset-password": { max: 5, windowMs: 60 * 60 * 1000 },
  upload: { max: 50, windowMs: 60 * 1000 },
  share: { max: 150, windowMs: 60 * 1000 },
  download: { max: 200, windowMs: 60 * 1000 },
  "file-operation": { max: 100, windowMs: 60 * 1000 },
  default: { max: 100, windowMs: 15 * 60 * 1000 },
};

function getLimit(action) {
  return LIMITS[action] || LIMITS["default"];
}

/**
 * Redis 기반 sliding window rate limiter
 * Sliding window: key format = rate:{action}:{identifier}:{windowIndex}
 * INCR로 atomic하게 카운트, TTL로 자동 만료
 *
 * @param {string} identifier - IP 주소 또는 사용자 식별자
 * @param {string} action - 액션 이름
 * @returns {Promise<{allowed, count, remaining, resetTime, retryAfter, limit}>}
 */
export async function checkRateLimit(identifier, action) {
  const limit = getLimit(action);
  const now = Date.now();
  const windowIndex = Math.floor(now / limit.windowMs);
  const key = `rate:${action}:${identifier}:${windowIndex}`;

  try {
    const client = getRedisClient();

    // INCR: atomic increment
    const count = await client.incr(key);

    // 첫 호출 시 TTL 설정 (window + 1초 버퍼)
    if (count === 1) {
      const ttlSeconds = Math.ceil(limit.windowMs / 1000) + 1;
      await client.expire(key, ttlSeconds);
    }

    const allowed = count <= limit.max;
    const remaining = Math.max(0, limit.max - count);
    const resetTime = now + limit.windowMs;
    const retryAfter = allowed ? null : Math.ceil(limit.windowMs / 2000);

    return {
      allowed,
      count,
      remaining,
      resetTime,
      retryAfter,
      limit: limit.max,
    };
  } catch (error) {
    console.error("Redis rate limiter error:", error.message);
    // fail-closed: Redis 장애 시 요청을 차단
    throw error;
  }
}

/**
 * Rate limit 초기화 (관리자용)
 */
export async function resetRateLimit(identifier, action) {
  try {
    const client = getRedisClient();
    const limit = getLimit(action);
    const windowIndex = Math.floor(Date.now() / limit.windowMs);
    const key = `rate:${action}:${identifier}:${windowIndex}`;
    await client.del(key);
    return true;
  } catch (error) {
    console.error("Rate limit reset error:", error.message);
    return false;
  }
}