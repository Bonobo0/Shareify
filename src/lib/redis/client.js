import Redis from "ioredis";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

let redis = null;

/**
 * Get Redis client instance (singleton pattern)
 * @returns {Redis} Redis client instance
 */
export function getRedisClient() {
  if (!redis) {
    console.log("Connecting to Redis at", REDIS_URL);
    redis = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        if (times > 3) {
          console.error("Redis connection failed after 3 retries");
          return null; // Stop retrying
        }
        return Math.min(times * 100, 3000); // Retry delay
      },
      // lazyConnect disabled to ensure connection is established immediately
      // and event listeners fire as expected
    });

    redis.on("error", (error) => {
      console.error("Redis connection error:", error.message);
    });

    redis.on("connect", () => {
      console.log("Redis connected successfully");
    });
  }

  return redis;
}

/**
 * Store refresh token in Redis with expiration
 * @param {string} userId - User ID
 * @param {string} jti - JWT ID (unique identifier for refresh token)
 * @param {number} expiresInSeconds - Token expiration time in seconds
 * @returns {Promise<void>}
 */
export async function storeRefreshToken(userId, jti, expiresInSeconds) {
  const client = getRedisClient();
  const key = `refresh_token:${userId}:${jti}`;

  try {
    await client.set(key, "valid", "EX", expiresInSeconds);
  } catch (error) {
    console.error("Failed to store refresh token in Redis:", error);
    throw new Error("Redis 저장 실패");
  }
}

/**
 * Validate refresh token in Redis
 * @param {string} userId - User ID
 * @param {string} jti - JWT ID
 * @returns {Promise<boolean>} Whether token is valid
 */
export async function validateRefreshToken(userId, jti) {
  const client = getRedisClient();
  const key = `refresh_token:${userId}:${jti}`;

  try {
    const result = await client.get(key);
    return result === "valid";
  } catch (error) {
    console.error("Failed to validate refresh token in Redis:", error);
    return false;
  }
}

/**
 * Invalidate (revoke) a refresh token
 * @param {string} userId - User ID
 * @param {string} jti - JWT ID
 * @returns {Promise<void>}
 */
export async function invalidateRefreshToken(userId, jti) {
  const client = getRedisClient();
  const key = `refresh_token:${userId}:${jti}`;

  try {
    await client.del(key);
  } catch (error) {
    console.error("Failed to invalidate refresh token in Redis:", error);
  }
}

/**
 * Invalidate all refresh tokens for a user (logout from all devices)
 * Uses SCAN instead of KEYS for production safety (non-blocking)
 * @param {string} userId - User ID
 * @returns {Promise<void>}
 */
export async function invalidateAllUserRefreshTokens(userId) {
  const client = getRedisClient();
  const pattern = `refresh_token:${userId}:*`;

  try {
    let cursor = "0";
    do {
      const [nextCursor, keys] = await client.scan(
        cursor,
        "MATCH",
        pattern,
        "COUNT",
        100,
      );
      cursor = nextCursor;

      if (keys.length > 0) {
        await client.del(...keys);
      }
    } while (cursor !== "0");
  } catch (error) {
    console.error("Failed to invalidate all user refresh tokens:", error);
  }
}

/**
 * Close Redis connection
 * @returns {Promise<void>}
 */
export async function closeRedisConnection() {
  if (redis) {
    await redis.quit();
    redis = null;
  }
}
