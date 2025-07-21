import { connectToDatabase } from "@/lib/db/mongodb";
import RateLimit from "@/models/RateLimit";

class DatabaseRateLimiter {
  // 액션별 제한 설정
  getLimits(action) {
    const limits = {
      "signup": { max: 3, windowMs: 60 * 60 * 1000 }, // 1시간에 3회
      "signin": { max: 10, windowMs: 15 * 60 * 1000 }, // 15분에 10회
      "forgot-password": { max: 3, windowMs: 60 * 60 * 1000 }, // 1시간에 3회
      "reset-password": { max: 5, windowMs: 60 * 60 * 1000 }, // 1시간에 5회
      "upload": { max: 50, windowMs: 60 * 1000 }, // 1분에 50회 업로드
      "share": { max: 150, windowMs: 60 * 1000 }, // 1분에 150회 공유
      "default": { max: 100, windowMs: 15 * 60 * 1000 }, // 기본: 15분에 100회
    };

    return limits[action] || limits["default"];
  }

  // Rate limit 체크 및 업데이트
  async checkLimit(identifier, action) {
    try {
      await connectToDatabase();

      const limits = this.getLimits(action);
      const now = new Date();
      const resetTime = new Date(now.getTime() + limits.windowMs);

      // 기존 레코드 찾기 또는 새로 생성
      let rateLimitRecord = await RateLimit.findOne({
        identifier,
        actionName: action,
      });

      if (!rateLimitRecord || now > rateLimitRecord.resetTime) {
        // 새로운 윈도우 시작 또는 기존 레코드가 없는 경우
        rateLimitRecord = await RateLimit.findOneAndUpdate(
          { identifier, actionName: action },
          {
            identifier,
            actionName: action,
            count: 1,
            resetTime,
            firstRequest: now,
          },
          {
            upsert: true,
            new: true,
            setDefaultsOnInsert: true,
          }
        );
      } else {
        // 기존 윈도우 내에서 카운트 증가
        rateLimitRecord = await RateLimit.findOneAndUpdate(
          { identifier, actionName: action },
          { $inc: { count: 1 } },
          { new: true }
        );
      }

      const isLimitExceeded = rateLimitRecord.count > limits.max;
      const remaining = Math.max(0, limits.max - rateLimitRecord.count);
      const retryAfter = isLimitExceeded
        ? Math.ceil(
            (rateLimitRecord.resetTime.getTime() - now.getTime()) / 1000
          )
        : null;

      return {
        allowed: !isLimitExceeded,
        count: rateLimitRecord.count,
        remaining,
        resetTime: rateLimitRecord.resetTime.getTime(),
        retryAfter,
        limit: limits.max,
      };
    } catch (error) {
      console.error("Rate limiter error:", error);
      // 에러 발생 시 요청 허용 (fail-open)
      return {
        allowed: true,
        count: 0,
        remaining: 100,
        resetTime: Date.now() + 15 * 60 * 1000,
        retryAfter: null,
        limit: 100,
      };
    }
  }

  // 특정 식별자의 rate limit 초기화
  async reset(identifier, action) {
    try {
      await connectToDatabase();
      await RateLimit.deleteOne({ identifier, actionName: action });
      console.log(`Rate limit reset for ${identifier} on ${action}`);
      return true;
    } catch (error) {
      console.error("Rate limit reset error:", error);
      return false;
    }
  }

  // 만료된 레코드 정리 (선택적 - MongoDB TTL이 자동으로 처리)
  async cleanup() {
    try {
      await connectToDatabase();
      const now = new Date();
      const result = await RateLimit.deleteMany({
        resetTime: { $lt: now },
      });
      console.log(
        `Cleaned up ${result.deletedCount} expired rate limit records`
      );
      return result.deletedCount;
    } catch (error) {
      console.error("Rate limit cleanup error:", error);
      return 0;
    }
  }

  // 통계 조회
  async getStats(identifier = null, action = null) {
    try {
      await connectToDatabase();

      const filter = {};
      if (identifier) filter.identifier = identifier;
      if (action) filter.actionName = action;

      const records = await RateLimit.find(filter)
        .sort({ createdAt: -1 })
        .limit(100);

      return records.map((record) => ({
        identifier: record.identifier,
        actionName: record.actionName,
        count: record.count,
        resetTime: record.resetTime,
        remaining: Math.max(
          0,
          this.getLimits(record.actionName).max - record.count
        ),
      }));
    } catch (error) {
      console.error("Rate limit stats error:", error);
      return [];
    }
  }
}

// 싱글톤 인스턴스
const dbRateLimiter = new DatabaseRateLimiter();

// IP 주소 추출 헬퍼 함수
export function getClientIP(request) {
  // Vercel/Cloudflare 등에서 실제 IP 가져오기
  const forwarded = request.headers.get("x-forwarded-for");
  const realIP = request.headers.get("x-real-ip");
  const cloudflareIP = request.headers.get("cf-connecting-ip");

  if (cloudflareIP) return cloudflareIP;
  if (realIP) return realIP;
  if (forwarded) return forwarded.split(",")[0].trim();

  // 개발 환경에서는 더미 IP 사용
  return "127.0.0.1";
}

export default dbRateLimiter;
