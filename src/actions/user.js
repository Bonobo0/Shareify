"use server";

import { connectToDatabase } from "@/lib/db/mongodb";
import { verifyToken } from "@/lib/auth/jwt";
import User from "@/models/User";
import File from "@/models/File";
import mongoose from "mongoose";
import { cookies } from "next/headers";
import { deleteMultipleObjects } from "@/lib/r2/r2Client";

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

export async function getUserInfo() {
  try {
    const userId = await getAuthenticatedUser();

    if (!userId) {
      return { error: "인증이 필요합니다." };
    }

    await connectToDatabase();

    // userId가 유효한 ObjectId인지 확인
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return { error: "유효하지 않은 사용자 ID" };
    }

    // 문자열 ID를 MongoDB ObjectId로 변환
    const objectId = new mongoose.Types.ObjectId(userId);
    const user = await User.findById(objectId).select("-password");

    if (!user) {
      return { error: "사용자를 찾을 수 없습니다." };
    }

    return {
      success: true,
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        createdAt: user.createdAt ? user.createdAt.toISOString() : null,
        storageLimit: user.storageLimit || 5368709120, // Default 5GB if null/undefined
        storageUsed: user.storageUsed || 0, // Default 0 if null/undefined
      },
    };
  } catch (error) {
    console.error("사용자 정보 조회 오류:", error);
    return {
      error: "사용자 정보를 조회하는 중 오류가 발생했습니다.",
    };
  }
}

export async function getStorageInfo() {
  try {
    const userId = await getAuthenticatedUser();

    if (!userId) {
      return { error: "인증이 필요합니다." };
    }

    await connectToDatabase();

    // userId가 유효한 ObjectId인지 확인
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return { error: "유효하지 않은 사용자 ID" };
    }

    // 문자열 ID를 MongoDB ObjectId로 변환
    const objectId = new mongoose.Types.ObjectId(userId);

    // 사용자 정보 조회
    const user = await User.findById(objectId);

    if (!user) {
      return { error: "사용자를 찾을 수 없습니다." };
    }

    // 사용자의 스토리지 할당량
    const storageQuota = user.storageLimit || 5 * 1024 * 1024 * 1024; // 5GB in bytes

    // 사용자가 업로드한 모든 파일 크기의 합계 계산
    const aggregationResult = await File.aggregate([
      {
        $match: {
          owner: objectId, // ObjectId 사용
          deleted: { $ne: true }, // 삭제된 파일 제외
        },
      },
      {
        $group: {
          _id: null,
          totalSize: { $sum: "$size" },
        },
      },
    ]);

    // 사용자가 업로드한 파일이 없는 경우 0으로 처리
    const usedStorage =
      aggregationResult.length > 0 ? aggregationResult[0].totalSize : 0;

    // 사용 가능한 스토리지 계산
    const availableStorage = Math.max(0, storageQuota - usedStorage);

    // 사용량 백분율 계산
    const usagePercentage = (usedStorage / storageQuota) * 100;

    return {
      success: true,
      usedStorage,
      availableStorage,
      quota: storageQuota,
      usagePercentage: parseFloat(usagePercentage.toFixed(2)),
    };
  } catch (error) {
    console.error("스토리지 정보 조회 오류:", error);
    return {
      error: "스토리지 정보를 조회하는 중 오류가 발생했습니다.",
    };
  }
}

export async function updateUserProfile({
  name,
  currentPassword,
  newPassword,
}) {
  try {
    const userId = await getAuthenticatedUser();

    if (!userId) {
      return { error: "인증이 필요합니다." };
    }

    await connectToDatabase();

    // 비밀번호 변경이 필요한 경우 password 필드도 포함해서 조회
    const selectFields = newPassword ? "+password" : "";
    const user = await User.findById(userId).select(selectFields);

    if (!user) {
      return { error: "사용자를 찾을 수 없습니다." };
    }

    // 이름 업데이트
    if (name && name.trim() !== "") {
      user.name = name.trim();
    }

    // 비밀번호 변경 요청이 있는 경우
    if (newPassword) {
      if (!currentPassword) {
        return { error: "현재 비밀번호를 입력해주세요." };
      }

      // 현재 비밀번호 확인
      try {
        const isCurrentPasswordValid = await user.comparePassword(
          currentPassword
        );
        if (!isCurrentPasswordValid) {
          return { error: "현재 비밀번호가 일치하지 않습니다." };
        }
      } catch (compareError) {
        console.error("비밀번호 비교 오류:", compareError);
        return { error: "비밀번호 확인 중 오류가 발생했습니다." };
      }

      // 새 비밀번호 유효성 검사
      if (newPassword.length < 6) {
        return { error: "새 비밀번호는 최소 6자 이상이어야 합니다." };
      }

      user.password = newPassword;
    }

    await user.save();

    return {
      success: true,
      message: "프로필이 성공적으로 업데이트되었습니다.",
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
      },
    };
  } catch (error) {
    console.error("프로필 업데이트 오류:", error);
    return {
      error: "프로필을 업데이트하는 중 오류가 발생했습니다.",
    };
  }
}

// 비밀번호 변경
export async function changePassword({
  currentPassword,
  newPassword,
  confirmPassword,
}) {
  try {
    const userId = await getAuthenticatedUser();

    if (!userId) {
      return { error: "인증이 필요합니다." };
    }

    if (!currentPassword || !newPassword || !confirmPassword) {
      return { error: "모든 필드를 입력해주세요." };
    }

    if (newPassword !== confirmPassword) {
      return { error: "새 비밀번호가 일치하지 않습니다." };
    }

    if (newPassword.length < 8) {
      return { error: "새 비밀번호는 최소 8자 이상이어야 합니다." };
    }

    await connectToDatabase();

    const user = await User.findById(userId).select("+password");
    if (!user) {
      return { error: "사용자를 찾을 수 없습니다." };
    }

    // 현재 비밀번호 확인
    const isCurrentPasswordValid = await user.comparePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      return { error: "현재 비밀번호가 올바르지 않습니다." };
    }

    // 새 비밀번호 설정
    user.password = newPassword;
    user.updatedAt = new Date();
    await user.save();

    return {
      success: true,
      message: "비밀번호가 성공적으로 변경되었습니다.",
    };
  } catch (error) {
    console.error("비밀번호 변경 오류:", error);
    return {
      error: "비밀번호 변경 중 오류가 발생했습니다.",
    };
  }
}

// 계정 삭제
export async function deleteAccount({ password }) {
  try {
    const userId = await getAuthenticatedUser();

    if (!userId) {
      return { error: "인증이 필요합니다." };
    }

    if (!password) {
      return { error: "비밀번호를 입력해주세요." };
    }

    await connectToDatabase();

    const user = await User.findById(userId).select("+password");
    if (!user) {
      return { error: "사용자를 찾을 수 없습니다." };
    }

    // 비밀번호 확인
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return { error: "비밀번호가 일치하지 않습니다." };
    }

    // 1. 사용자의 모든 파일 정보 조회
    const userFiles = await File.find({
      owner: userId,
      deleted: { $ne: true }, // 이미 삭제된 파일 제외
    }).select("fileName");

    console.log(
      `계정 삭제: 사용자 ${userId}의 파일 ${userFiles.length}개 발견`
    );

    // 2. R2에서 파일들 삭제
    if (userFiles.length > 0) {
      const r2Keys = userFiles
        .map((file) => file.fileName)
        .filter((key) => key); // fileName 있는 파일만

      if (r2Keys.length > 0) {
        console.log(`R2에서 ${r2Keys.length}개 파일 삭제 시작`);

        const deleteResult = await deleteMultipleObjects(r2Keys);

        if (!deleteResult.success) {
          console.error("R2 파일 삭제 중 일부 오류 발생:", deleteResult.errors);
          // R2 삭제 실패해도 계정 삭제는 계속 진행
        } else {
          console.log(`R2에서 ${deleteResult.deletedCount}개 파일 삭제 완료`);
        }
      }
    }

    // 3. 데이터베이스에서 사용자의 모든 파일 삭제
    await File.deleteMany({ owner: userId });

    // 4. 사용자 계정 삭제
    await User.findByIdAndDelete(userId);

    console.log(`계정 삭제 완료: 사용자 ${userId}`);

    return {
      success: true,
      message: "계정이 성공적으로 삭제되었습니다.",
    };
  } catch (error) {
    console.error("계정 삭제 오류:", error);
    return {
      error: "계정 삭제 중 오류가 발생했습니다.",
    };
  }
}
