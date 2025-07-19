import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/mongodb";
import { authenticateUser } from "@/lib/auth/jwt";
import User from "@/models/User";
import mongoose from "mongoose";

export async function GET(request) {
  try {
    const userId = await authenticateUser(request);

    if (!userId) {
      return NextResponse.json(
        { error: "인증되지 않은 사용자입니다." },
        { status: 401 }
      );
    }

    await connectToDatabase();

    // userId 검증
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      console.error("유효하지 않은 userId:", userId);
      return NextResponse.json(
        { error: "유효하지 않은 사용자 ID입니다." },
        { status: 400 }
      );
    }

    const user = await User.findById(userId).select("-password");

    if (!user) {
      return NextResponse.json(
        { error: "사용자를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      profileImage: user.profileImage,
      quota: user.quota,
      usedStorage: user.usedStorage,
      role: user.role,
      createdAt: user.createdAt,
    });
  } catch (error) {
    console.error("사용자 정보 조회 오류:", error);
    return NextResponse.json(
      { error: "사용자 정보를 조회하는 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
