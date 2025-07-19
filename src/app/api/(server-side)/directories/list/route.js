import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/mongodb";
import { authenticateUser } from "@/lib/auth/jwt";
import Directory from "@/models/Directory";
import mongoose from "mongoose";

export async function GET(request) {
  try {
    const userId = await authenticateUser(request);

    if (!userId) {
      return NextResponse.json(
        { error: "인증이 필요합니다." },
        { status: 401 }
      );
    }

    await connectToDatabase();

    // URL 파라미터 추출
    const { searchParams } = new URL(request.url);
    const parentId = searchParams.get("parentId");

    // 필터 조건 설정
    const filter = {
      $or: [
        { owner: new mongoose.Types.ObjectId(userId) },
        { "shared.userId": new mongoose.Types.ObjectId(userId) },
      ],
      deleted: { $ne: true },
    };

    // 특정 부모 디렉토리 내 디렉토리 조회 또는 루트 디렉토리 조회
    if (parentId) {
      filter.parent = new mongoose.Types.ObjectId(parentId);
    } else {
      filter.parent = null; // 루트 디렉토리만
    }

    // 디렉토리 조회
    const directories = await Directory.find(filter).sort({ name: 1 }).lean();

    return NextResponse.json({
      directories: directories.map((dir) => ({
        ...dir,
        id: dir._id.toString(),
        owner: dir.owner.toString() === userId,
        sharedWith:
          dir.shared?.map((share) => ({
            userId: share.userId.toString(),
            permission: share.permission,
          })) || [],
      })),
    });
  } catch (error) {
    console.error("디렉토리 목록 조회 오류:", error);
    return NextResponse.json(
      { error: "디렉토리 목록을 조회하는 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
