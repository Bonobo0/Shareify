import * as jose from "jose";

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET 환경 변수가 설정되어 있지 않습니다.");
}

const secretKey = new TextEncoder().encode(JWT_SECRET);

async function verifyToken(token) {
  if (!token || typeof token !== "string") {
    return null;
  }

  try {
    const { payload } = await jose.jwtVerify(token, secretKey, {
      algorithms: ["HS256"],
    });
    return payload;
  } catch (error) {
    console.error("Edge 토큰 검증 오류:", error.message);
    return null;
  }
}

export async function verifyAccessToken(token) {
  const payload = await verifyToken(token);
  if (!payload || payload.type !== "access") {
    return null;
  }
  return payload;
}
