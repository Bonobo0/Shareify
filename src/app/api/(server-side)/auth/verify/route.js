import { NextResponse } from "next/server";
import { authenticateUser } from "@/lib/auth/jwt";
import { connectToDatabase } from "@/lib/db/mongodb";
import User from "@/models/User";

export async function GET(req) {
  try {
    const userId = await authenticateUser(req);

    if (!userId) {
      return NextResponse.json(
        { error: "인증이 필요합니다." },
        { status: 401 }
      );
    }

    await connectToDatabase();

    // 사용자 정보 조회
    const user = await User.findById(userId).select("-password");

    if (!user) {
      return NextResponse.json(
        { error: "사용자를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
      },
    });
  } catch (error) {
    console.error("인증 확인 에러:", error);
    return NextResponse.json(
      { error: "인증 확인 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
