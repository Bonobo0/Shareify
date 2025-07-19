import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/mongodb";
import { authenticateUser } from "@/lib/auth/jwt";
import { generateDownloadUrl } from "@/lib/r2/r2Client";
import File from "@/models/File";

export async function GET(req, { params }) {
  try {
    const { id } = params;

    if (!id) {
      return NextResponse.json(
        { error: "파일 ID가 필요합니다." },
        { status: 400 }
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

    // 사용자 인증
    const userId = await authenticateUser(req);

    // 접근 권한 확인
    if (!file.isPublic) {
      if (!userId) {
        return NextResponse.json(
          { error: "인증이 필요합니다." },
          { status: 401 }
        );
      }

      // 소유자 확인
      if (file.userId.toString() !== userId) {
        // 공유 권한 확인
        const sharedUser = file.shared.find(
          (share) => share.userId.toString() === userId
        );
        if (!sharedUser) {
          return NextResponse.json(
            { error: "해당 파일에 접근할 권한이 없습니다." },
            { status: 403 }
          );
        }
      }
    }

    // 다운로드 URL 생성
    const downloadUrl = await generateDownloadUrl(file.path);

    return NextResponse.json({
      message: "다운로드 URL이 생성되었습니다.",
      downloadUrl,
      filename: file.originalName,
    });
  } catch (error) {
    console.error("다운로드 URL 생성 에러:", error);
    return NextResponse.json(
      { error: "다운로드 URL 생성 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
