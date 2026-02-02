"use server";

import { headers, cookies } from "next/headers";
import { getAuth } from "./auth";

/**
 * Server Action에서 현재 세션을 가져오는 헬퍼 함수
 * @returns {Promise<{session: object|null, user: object|null}>}
 */
export async function getServerSession() {
  try {
    const auth = await getAuth();
    const session = await auth.api.getSession({
      headers: headers(),
    });
    
    if (!session) {
      return { session: null, user: null };
    }
    
    return {
      session: session.session,
      user: session.user,
    };
  } catch (error) {
    console.error("세션 조회 오류:", error);
    return { session: null, user: null };
  }
}

/**
 * Server Action에서 인증된 사용자 ID를 가져오는 헬퍼 함수
 * @returns {Promise<string|null>}
 */
export async function getAuthenticatedUserId() {
  const { user } = await getServerSession();
  return user?.id || null;
}

/**
 * API Route에서 Bearer 토큰으로 세션을 검증하는 헬퍼 함수
 * @param {Request} request - Next.js Request 객체
 * @returns {Promise<{session: object|null, user: object|null}>}
 */
export async function getApiSession(request) {
  try {
    const auth = await getAuth();
    const session = await auth.api.getSession({
      headers: request.headers,
    });
    
    if (!session) {
      return { session: null, user: null };
    }
    
    return {
      session: session.session,
      user: session.user,
    };
  } catch (error) {
    console.error("API 세션 조회 오류:", error);
    return { session: null, user: null };
  }
}

/**
 * Bearer 토큰을 헤더에서 추출하는 유틸리티 함수
 * @param {string} authHeader - Authorization 헤더 값
 * @returns {string|null}
 */
export function extractBearerToken(authHeader) {
  if (!authHeader) return null;
  const trimmed = authHeader.trim();
  if (!trimmed.toLowerCase().startsWith("bearer ")) return null;
  return trimmed.slice(7).trim();
}
