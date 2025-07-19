import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/mongodb";
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

    // 공개 파일만 접근 가능
    if (!file.isPublic) {
      return NextResponse.json(
        { error: "이 파일은 비공개 상태입니다." },
        { status: 403 }
      );
    }

    return NextResponse.json({
      file: {
        id: file._id,
        originalName: file.originalName,
        mimetype: file.mimetype,
        size: file.size,
        hash: file.hash,
        createdAt: file.createdAt,
        // ownerName: file.owner.name || file.owner.email.split("@")[0],
      },
    });
  } catch (error) {
    console.error("공유 파일 정보 조회 에러:", error);
    return NextResponse.json(
      { error: "공유 파일 정보 조회 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
