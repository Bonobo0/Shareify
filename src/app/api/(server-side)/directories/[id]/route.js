import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/mongodb";
import { authenticateUser } from "@/lib/auth/jwt";
import Directory from "@/models/Directory";
import mongoose from "mongoose";

export async function GET(request, { params }) {
  try {
    const userId = await authenticateUser(request);

    if (!userId) {
      return NextResponse.json(
        { error: "인증이 필요합니다." },
        { status: 401 }
      );
    }

    const { id } = params;
    if (!id) {
      return NextResponse.json(
        { error: "디렉토리 ID가 필요합니다." },
        { status: 400 }
      );
    }

    await connectToDatabase();

    // 디렉토리 검색
    const directory = await Directory.findOne({
      $or: [{ _id: id }, { hash: id }],
      $or: [
        { owner: new mongoose.Types.ObjectId(userId) },
        { "shared.userId": new mongoose.Types.ObjectId(userId) },
      ],
      deleted: { $ne: true },
    }).lean();

    if (!directory) {
      return NextResponse.json(
        { error: "디렉토리를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    // 경로 정보 생성 (현재 디렉토리부터 루트까지의 경로)
    const breadcrumbs = [];
    let currentDir = directory;
    breadcrumbs.unshift({
      id: currentDir._id.toString(),
      name: currentDir.name,
      hash: currentDir.hash,
    });

    // 부모 디렉토리 정보 탐색 (최대 10번, 무한 루프 방지)
    let count = 0;
    while (currentDir.parent && count < 10) {
      count++;
      currentDir = await Directory.findById(currentDir.parent).lean();

      if (!currentDir || currentDir.deleted) break;

      breadcrumbs.unshift({
        id: currentDir._id.toString(),
        name: currentDir.name,
        hash: currentDir.hash,
      });
    }

    return NextResponse.json({
      directory: {
        ...directory,
        id: directory._id.toString(),
        owner: directory.owner.toString() === userId,
        sharedWith:
          directory.shared?.map((share) => ({
            userId: share.userId.toString(),
            permission: share.permission,
          })) || [],
      },
      breadcrumbs,
    });
  } catch (error) {
    console.error("디렉토리 정보 조회 오류:", error);
    return NextResponse.json(
      { error: "디렉토리 정보를 조회하는 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
