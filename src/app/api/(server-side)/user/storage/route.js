import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/mongodb";
import { authenticateUser } from "@/lib/auth/jwt";
import mongoose from "mongoose";
import User from "@/models/User";
import File from "@/models/File";

export async function GET(request) {
  try {
    // 사용자 인증
    const userId = await authenticateUser(request);

    if (!userId) {
      return NextResponse.json(
        { error: "인증되지 않은 사용자입니다." },
        { status: 401 }
      );
    }

    await connectToDatabase();

    // userId가 유효한 ObjectId인지 확인
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return NextResponse.json(
        { error: "유효하지 않은 사용자 ID" },
        { status: 400 }
      );
    }

    // 문자열 ID를 MongoDB ObjectId로 변환
    const objectId = new mongoose.Types.ObjectId(userId);

    // 사용자 정보 조회
    const user = await User.findById(objectId);

    if (!user) {
      return NextResponse.json(
        { error: "사용자를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    // 사용자의 스토리지 할당량 (기본값: 50GB)
    const storageQuota = user.quota || 50 * 1024 * 1024 * 1024; // 50GB in bytes

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

    return NextResponse.json({
      usedStorage,
      availableStorage,
      quota: storageQuota,
      usagePercentage: parseFloat(usagePercentage.toFixed(2)),
      status: "success",
    });
  } catch (error) {
    console.error("스토리지 정보 조회 오류:", error);

    return NextResponse.json(
      {
        error: "스토리지 정보를 조회하는 중 오류가 발생했습니다.",
        details: error.message,
      },
      { status: 500 }
    );
  }
}
