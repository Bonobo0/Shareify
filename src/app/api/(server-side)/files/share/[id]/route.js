import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/mongodb";
import { authenticateUser } from "@/lib/auth/jwt";
import File from "@/models/File";
import User from "@/models/User";

export async function POST(req, { params }) {
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

    const { email, permission } = await req.json();

    if (!email) {
      return NextResponse.json(
        { error: "공유할 사용자의 이메일이 필요합니다." },
        { status: 400 }
      );
    }

    if (!["read", "write", "admin"].includes(permission)) {
      return NextResponse.json(
        { error: "유효한 권한 유형이 필요합니다." },
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

    // 소유자 또는 관리자 권한 확인
    const isOwner = file.owner.toString() === userId;
    const isAdmin = file.shared.some(
      (share) =>
        share.userId.toString() === userId && share.permission === "admin"
    );

    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { error: "이 파일을 공유할 권한이 없습니다." },
        { status: 403 }
      );
    }

    // 공유할 사용자 조회
    const targetUser = await User.findOne({ email });

    if (!targetUser) {
      return NextResponse.json(
        { error: "지정한 이메일을 가진 사용자를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    // 자기 자신에게 공유 불가
    if (targetUser._id.toString() === userId) {
      return NextResponse.json(
        { error: "자신에게 파일을 공유할 수 없습니다." },
        { status: 400 }
      );
    }

    // 이미 공유된 사용자인지 확인
    const alreadyShared = file.shared.find(
      (share) => share.userId.toString() === targetUser._id.toString()
    );

    if (alreadyShared) {
      // 권한 업데이트
      alreadyShared.permission = permission;
    } else {
      // 새로운 공유 추가
      file.shared.push({
        userId: targetUser._id,
        permission,
      });
    }

    file.updatedAt = Date.now();
    await file.save();

    return NextResponse.json({
      message: `${targetUser.email}에게 파일이 공유되었습니다.`,
      shared: {
        userId: targetUser._id,
        email: targetUser.email,
        permission,
      },
    });
  } catch (error) {
    console.error("파일 공유 에러:", error);
    return NextResponse.json(
      { error: "파일 공유 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
