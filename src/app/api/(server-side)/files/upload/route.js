import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/mongodb";
import { authenticateUser } from "@/lib/auth/jwt";
import User from "@/models/User";
import File from "@/models/File";
import mongoose from "mongoose";
import {
  generateUniqueFilename,
  generateFileHash,
  generateUploadUrl,
} from "@/lib/r2/r2Client";

export async function POST(request) {
  try {
    const userId = await authenticateUser(request);

    if (!userId) {
      return NextResponse.json(
        { error: "인증이 필요합니다." },
        { status: 401 }
      );
    }

    // JSON 요청 본문 파싱
    const { filename, size, mimetype, directoryId } = await request.json();

    if (!filename || !size || !mimetype) {
      return NextResponse.json(
        { error: "필수 파일 정보가 누락되었습니다." },
        { status: 400 }
      );
    }

    await connectToDatabase();

    // 사용자 정보 조회
    const user = await User.findById(userId);
    if (!user) {
      return NextResponse.json(
        { error: "사용자를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    // 용량 확인
    if (user.usedStorage + parseInt(size) > user.quota) {
      return NextResponse.json(
        { error: "저장 공간이 부족합니다." },
        { status: 400 }
      );
    }

    // 파일 정보 생성
    const uniqueFilename = generateUniqueFilename(filename);
    const hash = generateFileHash();
    const filePath = `${userId}/${uniqueFilename}`;

    // 업로드용 Presigned URL 생성
    const uploadUrl = await generateUploadUrl(filePath, mimetype);

    // 데이터베이스에 파일 정보 저장 (업로드 전)
    const fileDoc = new File({
      owner: new mongoose.Types.ObjectId(userId),
      originalName: filename,
      fileName: uniqueFilename,
      hash,
      size: parseInt(size),
      mimetype,
      path: filePath,
      isPublic: false,
      parentDirectory: directoryId
        ? new mongoose.Types.ObjectId(directoryId)
        : null,
      uploaded: false, // 아직 업로드되지 않음
    });

    await fileDoc.save();

    // Presigned URL과 파일 ID 반환
    return NextResponse.json({
      success: true,
      uploadUrl,
      fileId: fileDoc._id.toString(),
      hash,
      message: "업로드 URL이 생성되었습니다.",
    });
  } catch (error) {
    console.error("업로드 URL 생성 오류:", error);
    return NextResponse.json(
      {
        error: "업로드 URL을 생성하는 중 오류가 발생했습니다.",
        details: error.message,
      },
      { status: 500 }
    );
  }
}
