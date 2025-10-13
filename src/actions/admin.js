"use server";

import { connectToDatabase } from "@/lib/db/router";
import { getModel } from "@/lib/db/router";
import { verifyToken } from "@/lib/auth/jwt";
import mongoose from "mongoose";
import { cookies } from "next/headers";

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

  await connectToDatabase();
  const User = await getModel('User');
  
  const user = await User.findById(userId);
  if (!user || user.role !== "admin") {
    return { error: "관리자 권한이 필요합니다." };
  }

  return { success: true, userId };
}

export async function getAllUsers({ page = 1, limit = 50, sortBy = "createdAt", sortOrder = "desc" } = {}) {
  try {
    const adminCheck = await checkAdminPermission();
    if (adminCheck.error) {
      return adminCheck;
    }

    const User = await getModel('User');
    const skip = (page - 1) * limit;
    const sortDirection = sortOrder === "desc" ? -1 : 1;

    const users = await User.find({})
      .select("name email role storageLimit storageUsed isVerified createdAt updatedAt suspended")
      .sort({ [sortBy]: sortDirection })
      .skip(skip)
      .limit(limit)
      .lean();

    const totalUsers = await User.countDocuments({});

    return {
      success: true,
      users: users.map(user => ({
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        storageLimit: user.storageLimit || 5368709120, // Default 5GB if null/undefined
        storageUsed: user.storageUsed || 0, // Default 0 if null/undefined
        isVerified: user.isVerified,
        suspended: user.suspended || false,
        createdAt: user.createdAt ? user.createdAt.toISOString() : null,
        updatedAt: user.updatedAt ? user.updatedAt.toISOString() : null,
      })),
      pagination: {
        totalUsers,
        currentPage: page,
        limit,
        totalPages: Math.ceil(totalUsers / limit),
      },
    };
  } catch (error) {
    console.error("사용자 목록 조회 오류:", error);
    return { error: "사용자 목록을 조회하는 중 오류가 발생했습니다." };
  }
}

export async function updateUserQuota({ userId, newLimit }) {
  try {
    const adminCheck = await checkAdminPermission();
    if (adminCheck.error) {
      return adminCheck;
    }

    if (!userId || !newLimit || newLimit < 0) {
      return { error: "유효하지 않은 파라미터입니다." };
    }

    await connectToDatabase();
    const User = await getModel('User');

    const user = await User.findById(userId);
    if (!user) {
      return { error: "사용자를 찾을 수 없습니다." };
    }

    // Update storage limit
    user.storageLimit = newLimit;
    user.updatedAt = new Date();
    await user.save();

    return {
      success: true,
      message: `${user.email}의 저장소 할당량이 ${Math.round(newLimit / (1024 * 1024 * 1024))}GB로 변경되었습니다.`,
    };
  } catch (error) {
    console.error("저장소 할당량 업데이트 오류:", error);
    return { error: "저장소 할당량을 업데이트하는 중 오류가 발생했습니다." };
  }
}

export async function updateUserRole({ userId, newRole }) {
  try {
    const adminCheck = await checkAdminPermission();
    if (adminCheck.error) {
      return adminCheck;
    }

    if (!userId || !newRole || !["user", "admin"].includes(newRole)) {
      return { error: "유효하지 않은 파라미터입니다." };
    }

    await connectToDatabase();
    const User = await getModel('User');

    const user = await User.findById(userId);
    if (!user) {
      return { error: "사용자를 찾을 수 없습니다." };
    }

    // Prevent removing the last admin
    if (user.role === "admin" && newRole === "user") {
      const adminCount = await User.countDocuments({ role: "admin" });
      if (adminCount <= 1) {
        return { error: "마지막 관리자는 역할을 변경할 수 없습니다." };
      }
    }

    // Update user role
    user.role = newRole;
    user.updatedAt = new Date();
    await user.save();

    return {
      success: true,
      message: `${user.email}의 역할이 ${newRole === "admin" ? "관리자" : "사용자"}로 변경되었습니다.`,
    };
  } catch (error) {
    console.error("사용자 역할 업데이트 오류:", error);
    return { error: "사용자 역할을 업데이트하는 중 오류가 발생했습니다." };
  }
}

export async function suspendUser({ userId, suspended }) {
  try {
    const adminCheck = await checkAdminPermission();
    if (adminCheck.error) {
      return adminCheck;
    }

    if (!userId || typeof suspended !== "boolean") {
      return { error: "유효하지 않은 파라미터입니다." };
    }

    await connectToDatabase();
    const User = await getModel('User');

    const user = await User.findById(userId);
    if (!user) {
      return { error: "사용자를 찾을 수 없습니다." };
    }

    // Prevent suspending admins
    if (user.role === "admin" && suspended) {
      return { error: "관리자는 정지시킬 수 없습니다." };
    }

    // Update suspension status
    user.suspended = suspended;
    user.updatedAt = new Date();
    await user.save();

    return {
      success: true,
      message: `${user.email}이 ${suspended ? "정지" : "활성화"}되었습니다.`,
    };
  } catch (error) {
    console.error("사용자 정지 상태 업데이트 오류:", error);
    return { error: "사용자 상태를 업데이트하는 중 오류가 발생했습니다." };
  }
}

export async function getUserStats() {
  try {
    const adminCheck = await checkAdminPermission();
    if (adminCheck.error) {
      return adminCheck;
    }

    await connectToDatabase();
    const User = await getModel('User');

    const totalUsers = await User.countDocuments({});
    const verifiedUsers = await User.countDocuments({ isVerified: true });
    const adminUsers = await User.countDocuments({ role: "admin" });
    const suspendedUsers = await User.countDocuments({ suspended: true });

    // Calculate total storage usage
    const storageStats = await User.aggregate([
      {
        $group: {
          _id: null,
          totalUsed: { $sum: { $ifNull: ["$storageUsed", 0] } },
          totalLimit: { $sum: { $ifNull: ["$storageLimit", 5368709120] } },
        },
      },
    ]);

    const storage = storageStats[0] || { totalUsed: 0, totalLimit: 0 };

    return {
      success: true,
      stats: {
        totalUsers,
        verifiedUsers,
        adminUsers,
        suspendedUsers,
        unverifiedUsers: totalUsers - verifiedUsers,
        totalStorageUsed: storage.totalUsed,
        totalStorageLimit: storage.totalLimit,
      },
    };
  } catch (error) {
    console.error("사용자 통계 조회 오류:", error);
    return { error: "사용자 통계를 조회하는 중 오류가 발생했습니다." };
  }
}

export async function searchUsers({ query, limit = 20 }) {
  try {
    const adminCheck = await checkAdminPermission();
    if (adminCheck.error) {
      return adminCheck;
    }

    if (!query || query.trim().length < 2) {
      return { error: "검색어는 최소 2글자 이상이어야 합니다." };
    }

    await connectToDatabase();
    const User = await getModel('User');

    const searchRegex = new RegExp(query.trim(), "i");
    
    const users = await User.find({
      $or: [
        { name: { $regex: searchRegex } },
        { email: { $regex: searchRegex } },
      ],
    })
      .select("name email role storageLimit storageUsed isVerified createdAt suspended")
      .limit(limit)
      .lean();

    return {
      success: true,
      users: users.map(user => ({
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        storageLimit: user.storageLimit || 5368709120, // Default 5GB if null/undefined
        storageUsed: user.storageUsed || 0, // Default 0 if null/undefined
        isVerified: user.isVerified,
        suspended: user.suspended || false,
        createdAt: user.createdAt ? user.createdAt.toISOString() : null,
      })),
    };
  } catch (error) {
    console.error("사용자 검색 오류:", error);
    return { error: "사용자를 검색하는 중 오류가 발생했습니다." };
  }
}

export async function deleteUser({ userId, confirmEmail }) {
  try {
    const adminCheck = await checkAdminPermission();
    if (adminCheck.error) {
      return adminCheck;
    }

    if (!userId || !confirmEmail) {
      return { error: "사용자 ID와 확인용 이메일이 필요합니다." };
    }

    await connectToDatabase();
    const User = await getModel('User');

    const user = await User.findById(userId);
    if (!user) {
      return { error: "사용자를 찾을 수 없습니다." };
    }

    if (user.email !== confirmEmail) {
      return { error: "확인용 이메일이 일치하지 않습니다." };
    }

    if (user.role === "admin") {
      const adminCount = await User.countDocuments({ role: "admin" });
      if (adminCount <= 1) {
        return { error: "마지막 관리자는 삭제할 수 없습니다." };
      }
    }

    // TODO: Also delete user's files and directories
    // This would require additional cleanup logic

    await User.findByIdAndDelete(userId);

    return {
      success: true,
      message: `사용자 ${confirmEmail}이 삭제되었습니다.`,
    };
  } catch (error) {
    console.error("사용자 삭제 오류:", error);
    return { error: "사용자를 삭제하는 중 오류가 발생했습니다." };
  }
}