import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/mongodb";
import { generateDownloadUrl } from "@/lib/r2/r2Client";
import File from "@/models/File";

export async function GET(req, { params }) {
  try {
    const { hash } = params;

    if (!hash) {
      return NextResponse.json(
        { error: "파일 해시가 필요합니다." },
        { status: 400 }
      );
    }

    await connectToDatabase();

    // 파일 조회
    const file = await File.findOne({ hash });

    if (!file) {
      return NextResponse.json(
        { error: "파일을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    // 공개 파일만 다운로드 가능
    if (!file.isPublic) {
      return NextResponse.json(
        { error: "이 파일은 비공개 상태입니다." },
        { status: 403 }
      );
    }

    // 다운로드 URL 생성
    const downloadUrl = await generateDownloadUrl(file.path);

    return NextResponse.json({
      message: "다운로드 URL이 생성되었습니다.",
      downloadUrl,
      filename: file.originalName,
    });
  } catch (error) {
    console.error("공유 파일 다운로드 URL 생성 에러:", error);
    return NextResponse.json(
      { error: "다운로드 URL 생성 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
