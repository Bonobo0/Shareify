"use server";

import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth/jwt";
import { getModel } from "@/lib/db/router";
import { 
  getDBSettings, 
  setDBSettings, 
  getEffectiveDBType, 
  getAvailableDatabases 
} from "@/lib/db/settings";
import { clearDBTypeCache } from "@/lib/db/router";

async function getAuthenticatedUser() {
  const token = cookies().get("token")?.value;

  if (!token) {
    return null;
  }

  const decoded = await verifyToken(token);
  if (!decoded) {
    return null;
  }

  return decoded.userId;
}

async function checkAdminPermission() {
  const userId = await getAuthenticatedUser();

  if (!userId) {
    return { error: "인증이 필요합니다." };
  }

  const User = await getModel('User');
  const user = await User.findById(userId);
  if (!user || user.role !== "admin") {
    return { error: "관리자 권한이 필요합니다." };
  }

  return { success: true, userId };
}

// Get current DB settings
export async function getDBConfig() {
  try {
    const adminCheck = await checkAdminPermission();
    if (adminCheck.error) {
      return adminCheck;
    }

    const settings = await getDBSettings();
    const effectiveType = await getEffectiveDBType();
    const available = await getAvailableDatabases();

    return {
      success: true,
      settings,
      effectiveType,
      available,
    };
  } catch (error) {
    console.error("DB 설정 조회 오류:", error);
    return { error: "DB 설정을 조회하는 중 오류가 발생했습니다." };
  }
}

// Update DB settings
export async function updateDBConfig({ preferredDatabase }) {
  try {
    const adminCheck = await checkAdminPermission();
    if (adminCheck.error) {
      return adminCheck;
    }

    if (!["auto", "postgresql", "mongodb"].includes(preferredDatabase)) {
      return { error: "유효하지 않은 데이터베이스 타입입니다." };
    }

    const result = await setDBSettings({ preferredDatabase });
    
    if (result.error) {
      return result;
    }

    // Clear the cache so new setting takes effect
    clearDBTypeCache();

    const effectiveType = await getEffectiveDBType();

    return {
      success: true,
      message: `데이터베이스가 ${preferredDatabase === 'auto' ? '자동' : preferredDatabase}으로 설정되었습니다.`,
      settings: result.settings,
      effectiveType,
    };
  } catch (error) {
    console.error("DB 설정 업데이트 오류:", error);
    return { error: "DB 설정을 업데이트하는 중 오류가 발생했습니다." };
  }
}

// Test database connection
export async function testDBConnection({ dbType }) {
  try {
    const adminCheck = await checkAdminPermission();
    if (adminCheck.error) {
      return adminCheck;
    }

    if (!["postgresql", "mongodb"].includes(dbType)) {
      return { error: "유효하지 않은 데이터베이스 타입입니다." };
    }

    if (dbType === "postgresql") {
      const hasConfig = !!process.env.DATABASE_URL;
      if (!hasConfig) {
        return { error: "DATABASE_URL이 설정되지 않았습니다." };
      }

      try {
        const { connectToDatabase } = await import("@/lib/db/postgresql.js");
        await connectToDatabase();
        return { success: true, message: "PostgreSQL 연결 성공!" };
      } catch (error) {
        return { error: `PostgreSQL 연결 실패: ${error.message}` };
      }
    } else {
      const hasConfig = !!process.env.MONGODB_URI;
      if (!hasConfig) {
        return { error: "MONGODB_URI가 설정되지 않았습니다." };
      }

      try {
        const { connectToDatabase } = await import("@/lib/db/mongodb.js");
        await connectToDatabase();
        return { success: true, message: "MongoDB 연결 성공!" };
      } catch (error) {
        return { error: `MongoDB 연결 실패: ${error.message}` };
      }
    }
  } catch (error) {
    console.error("DB 연결 테스트 오류:", error);
    return { error: "DB 연결 테스트 중 오류가 발생했습니다." };
  }
}
