"use server";

import {
  getActionRateLimitStats,
  resetActionRateLimit,
} from "@/lib/actionRateLimit";
import { verifyToken } from "@/lib/auth/jwt";
import { cookies } from "next/headers";
import { connectToDatabase } from "@/lib/db/mongodb";
import User from "@/models/User";

// 관리자 권한 확인
async function isAdmin() {
  try {
    const token = cookies().get("token")?.value;
    if (!token) return false;

    const decoded = await verifyToken(token);
    if (!decoded) return false;

    await connectToDatabase();
    const user = await User.findById(decoded.userId);

    if (user?.role === "admin") return true;

    return false;
  } catch (error) {
    console.error("Admin check error:", error);
    return false;
  }
}

// Rate limit 통계 조회
export async function getRateLimitStats(action = null, identifier = null) {
  try {
    if (!(await isAdmin())) {
      return {
        success: false,
        error: "관리자 권한이 필요합니다.",
      };
    }

    const stats = await getActionRateLimitStats(action, identifier);

    return {
      success: true,
      stats,
      totalRecords: stats.length,
    };
  } catch (error) {
    console.error("Rate limit stats error:", error);
    return {
      success: false,
      error: "통계 조회 중 오류가 발생했습니다.",
    };
  }
}

// Rate limit 초기화
export async function resetRateLimit(action, identifier) {
  try {
    if (!(await isAdmin())) {
      return {
        success: false,
        error: "관리자 권한이 필요합니다.",
      };
    }

    if (!action || !identifier) {
      return {
        success: false,
        error: "action과 identifier 파라미터가 필요합니다.",
      };
    }

    const success = await resetActionRateLimit(action, identifier);

    if (success) {
      return {
        success: true,
        message: `${identifier}의 ${action} rate limit이 초기화되었습니다.`,
      };
    } else {
      return {
        success: false,
        error: "Rate limit 초기화에 실패했습니다.",
      };
    }
  } catch (error) {
    console.error("Rate limit reset error:", error);
    return {
      success: false,
      error: "Rate limit 초기화 중 오류가 발생했습니다.",
    };
  }
}
