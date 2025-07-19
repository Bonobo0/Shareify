import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/mongodb";
import User from "@/models/User";
import { generateToken } from "@/lib/auth/jwt";

export async function POST(req) {
  try {
    await connectToDatabase();

    const { email, password, name } = await req.json();

    // 이메일 유효성 검사
    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { error: "유효한 이메일을 입력해주세요." },
        { status: 400 }
      );
    }

    // 비밀번호 유효성 검사
    if (!password || password.length < 6) {
      return NextResponse.json(
        { error: "비밀번호는 최소 6자 이상이어야 합니다." },
        { status: 400 }
      );
    }

    // 이미 가입된 이메일인지 확인
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return NextResponse.json(
        { error: "이미 사용 중인 이메일입니다." },
        { status: 409 }
      );
    }

    // 새 사용자 생성
    const user = new User({
      email,
      password,
      name: name || email.split("@")[0],
    });

    await user.save();

    const token = generateToken(user._id);

    return NextResponse.json(
      {
        message: "회원가입이 완료되었습니다.",
        token,
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("회원가입 에러:", error);
    return NextResponse.json(
      { error: "회원가입 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
