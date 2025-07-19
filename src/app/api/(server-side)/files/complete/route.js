import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/mongodb";
import { authenticateUser } from "@/lib/auth/jwt";
import User from "@/models/User";
import File from "@/models/File";
import mongoose from "mongoose";

export async function POST(request) {
  try {
    const userId = await authenticateUser(request);

    if (!userId) {
      return NextResponse.json(
        { error: "인증이 필요합니다." },
        { status: 401 }
      );
    }

    const { fileId } = await request.json();

    if (!fileId) {
      return NextResponse.json(
        { error: "파일 ID가 필요합니다." },
        { status: 400 }
      );
    }

    await connectToDatabase();

    // 파일 찾기
    const file = await File.findById(fileId);

    if (!file) {
      return NextResponse.json(
        { error: "파일을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    if (file.owner.toString() !== userId) {
      return NextResponse.json(
        { error: "이 파일에 대한 권한이 없습니다." },
        { status: 403 }
      );
    }

    if (file.uploaded) {
      return NextResponse.json({
        success: true,
        message: "이미 처리된 파일입니다.",
      });
    }

    // 업로드 완료 처리 및 사용자 스토리지 사용량 업데이트
    file.uploaded = true;
    await file.save();

    await User.findByIdAndUpdate(userId, {
      $inc: { usedStorage: file.size },
    });

    return NextResponse.json({
      success: true,
      message: "파일 업로드가 완료되었습니다.",
    });
  } catch (error) {
    console.error("파일 업로드 완료 처리 오류:", error);
    return NextResponse.json(
      {
        error: "파일 업로드 완료 처리 중 오류가 발생했습니다.",
        details: error.message,
      },
      { status: 500 }
    );
  }
}
