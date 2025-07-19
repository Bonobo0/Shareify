import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/mongodb";
import { authenticateUser } from "@/lib/auth/jwt";
import User from "@/models/User";
import mongoose from "mongoose";

export async function GET(request) {
  try {
    const userId = await authenticateUser(request);

    if (!userId) {
      return NextResponse.json({ error: "인증되지 않음" }, { status: 401 });
    }

    await connectToDatabase();

    console.log("인증된 userId:", userId);

    // userId가 유효한 ObjectId인지 확인
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return NextResponse.json(
        { error: "유효하지 않은 사용자 ID" },
        { status: 400 }
      );
    }

    // 문자열 ID를 MongoDB ObjectId로 변환
    const objectId = new mongoose.Types.ObjectId(userId);
    const user = await User.findById(objectId).select("-password");

    if (!user) {
      return NextResponse.json(
        { error: "사용자를 찾을 수 없음" },
        { status: 404 }
      );
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error("사용자 정보 조회 오류:", error);
    return NextResponse.json(
      {
        error: "사용자 정보 조회 중 오류가 발생했습니다.",
        details: error.message,
      },
      { status: 500 }
    );
  }
}
