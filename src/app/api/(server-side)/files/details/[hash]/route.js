import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/mongodb";
import { authenticateUser } from "@/lib/auth/jwt";
import File from "@/models/File";
import User from "@/models/User";

export async function GET(req, { params }) {
  try {
    const { hash } = params;

    if (!hash) {
      return NextResponse.json(
        { error: "파일 해시가 필요합니다." },
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
    const file = await File.findOne({ hash });
    console.log("파일 조회:", file);
    if (!file) {
      return NextResponse.json(
        { error: "파일을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    // 접근 권한 확인
    const isOwner = file.owner.toString() === userId;
    const isShared = file.shared.some(
      (share) => share.userId.toString() === userId
    );

    if (!isOwner && !isShared && !file.isPublic) {
      return NextResponse.json(
        { error: "해당 파일에 접근할 권한이 없습니다." },
        { status: 403 }
      );
    }

    // 공유된 사용자 정보 조회
    let sharedUsers = [];
    if (isOwner && file.shared.length > 0) {
      const userIds = file.shared.map((share) => share.userId);
      const users = await User.find({ _id: { $in: userIds } });

      sharedUsers = file.shared.map((share) => {
        const user = users.find(
          (u) => u._id.toString() === share.userId.toString()
        );
        return {
          userId: share.userId,
          permission: share.permission,
        };
      });
    }

    return NextResponse.json({
      file: {
        id: file._id,
        originalName: file.originalName,
        filename: file.filename,
        mimetype: file.mimetype,
        size: file.size,
        path: file.path,
        hash: file.hash,
        createdAt: file.createdAt,
        updatedAt: file.updatedAt,
        isPublic: file.isPublic,
        owner: isOwner,
        shared: sharedUsers,
      },
    });
  } catch (error) {
    console.error("파일 세부 정보 조회 에러:", error);
    return NextResponse.json(
      { error: "파일 세부 정보 조회 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
