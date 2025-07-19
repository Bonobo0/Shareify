import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/mongodb";
import { authenticateUser } from "@/lib/auth/jwt";
import File from "@/models/File";

export async function PUT(req, { params }) {
  try {
    const { id } = params;

    if (!id) {
      return NextResponse.json(
        { error: "파일 ID가 필요합니다." },
        { status: 400 }
      );
    }

    const userId = await authenticateUser(req);
    if (!userId) {
      return NextResponse.json(
        { error: "인증이 필요합니다." },
        { status: 401 }
      );
    }

    await connectToDatabase();

    // 파일 조회
    const file = await File.findById(id);

    if (!file) {
      return NextResponse.json(
        { error: "파일을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    // 소유자 확인
    if (file.owner.toString() !== userId) {
      return NextResponse.json(
        { error: "이 파일의 접근 권한을 변경할 권한이 없습니다." },
        { status: 403 }
      );
    }

    const { isPublic } = await req.json();

    // 접근 권한 업데이트
    file.isPublic = isPublic;
    file.updatedAt = Date.now();
    await file.save();

    return NextResponse.json({
      message: `파일이 ${isPublic ? "공개" : "비공개"}로 설정되었습니다.`,
      file: {
        id: file._id,
        isPublic: file.isPublic,
      },
    });
  } catch (error) {
    console.error("파일 접근 권한 변경 에러:", error);
    return NextResponse.json(
      { error: "파일 접근 권한 변경 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
