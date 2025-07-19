import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/mongodb";
import { authenticateUser } from "@/lib/auth/jwt";
import File from "@/models/File"; // default import로 수정
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
    const directoryId = searchParams.get("directoryId");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const sortBy = searchParams.get("sortBy") || "createdAt";
    const sortOrder = searchParams.get("sortOrder") || "desc";

    // 정렬 옵션
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === "asc" ? 1 : -1;

    // 필터 조건
    const filter = {
      $or: [
        { owner: new mongoose.Types.ObjectId(userId) }, // owner -> userId로 수정
        { "shared.userId": new mongoose.Types.ObjectId(userId) },
      ],
      deleted: { $ne: true },
    };

    // 디렉토리 필터링
    if (directoryId) {
      filter.parentDirectory = new mongoose.Types.ObjectId(directoryId);
    } else {
      // 루트 디렉토리의 파일만 조회
      filter.parentDirectory = null;
    }

    // 디버깅용 로그
    console.log("MongoDB Filter:", JSON.stringify(filter));
    console.log("Sort Options:", sortOptions);

    // 파일 조회 (페이지네이션 적용)
    const skip = (page - 1) * limit;
    const files = await File.find(filter)
      .sort(sortOptions)
      .skip(skip)
      .limit(limit)
      .lean();

    console.log("Files found:", files.length);

    // 총 파일 수
    const totalFiles = await File.countDocuments(filter);
    const totalPages = Math.ceil(totalFiles / limit);

    return NextResponse.json({
      files: files.map((file) => ({
        ...file,
        id: file._id.toString(),
        owner: file.owner.toString() === userId,
        sharedWith:
          file.shared?.map((share) => ({
            userId: share.userId.toString(),
            permission: share.permission,
          })) || [],
      })),
      pagination: {
        page,
        limit,
        totalFiles,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    console.error("파일 목록 조회 오류:", error);
    return NextResponse.json(
      {
        error: "파일 목록을 조회하는 중 오류가 발생했습니다.",
        details: error.message,
        stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
