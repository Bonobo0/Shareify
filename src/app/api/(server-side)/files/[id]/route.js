import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/mongodb";
import { authenticateUser } from "@/lib/auth/jwt";
import File from "@/models/File";
import User from "@/models/User";
import { deleteObject } from "@/lib/r2/r2Client";

export async function DELETE(req, { params }) {
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
        { error: "이 파일을 삭제할 권한이 없습니다." },
        { status: 403 }
      );
    }

    // R2에서 파일 삭제
    try {
      await deleteObject(file.path);
    } catch (err) {
      console.error("R2 파일 삭제 실패:", err);
      // R2 삭제 실패해도 메타데이터는 삭제 진행
    }

    // MongoDB에서 파일 메타데이터 삭제
    await File.findByIdAndDelete(id);

    // 사용자의 사용 스토리지 크기 업데이트
    await User.findByIdAndUpdate(userId, {
      $inc: { usedStorage: -file.size },
    });

    return NextResponse.json({
      message: "파일이 삭제되었습니다.",
    });
  } catch (error) {
    console.error("파일 삭제 에러:", error);
    return NextResponse.json(
      { error: "파일 삭제 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
