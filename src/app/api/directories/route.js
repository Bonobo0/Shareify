import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/mongodb";
import { authenticateUser } from "@/lib/auth/jwt";
import Directory from "@/models/Directory";
import mongoose from "mongoose";
import crypto from "crypto";

// 디렉토리 목록 조회
export async function GET(request) {
  try {
    const userId = await authenticateUser(request);

    if (!userId) {
      return NextResponse.json(
        { error: "인증이 필요합니다." },
        { status: 401 }
      );
    }

    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const parentId = searchParams.get("parentId");

    // 필터 조건 설정
    const filter = {
      $or: [
        { userId: new mongoose.Types.ObjectId(userId) },
        { "shared.userId": new mongoose.Types.ObjectId(userId) },
      ],
      deleted: { $ne: true },
    };

    // 특정 부모 디렉토리 내 디렉토리 조회 또는 루트 디렉토리 조회
    if (parentId) {
      filter.parent = new mongoose.Types.ObjectId(parentId);
    } else {
      filter.parent = null;
    }

    const directories = await Directory.find(filter).sort({ name: 1 }).lean();

    return NextResponse.json({
      directories: directories.map((dir) => ({
        id: dir._id.toString(),
        name: dir.name,
        hash: dir.hash,
        parent: dir.parent ? dir.parent.toString() : null,
        createdAt: dir.createdAt,
        updatedAt: dir.updatedAt,
        owner: dir.userId.toString() === userId,
        sharedWith:
          dir.shared?.map((s) => ({
            userId: s.userId.toString(),
            permission: s.permission,
          })) || [],
      })),
    });
  } catch (error) {
    console.error("디렉토리 목록 조회 오류:", error);
    return NextResponse.json(
      { error: "디렉토리 목록을 조회하는 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

// 디렉토리 생성
export async function POST(request) {
  try {
    const userId = await authenticateUser(request);

    if (!userId) {
      return NextResponse.json(
        { error: "인증이 필요합니다." },
        { status: 401 }
      );
    }

    const { name, parent } = await request.json();

    if (!name || name.trim() === "") {
      return NextResponse.json(
        { error: "디렉토리 이름은 필수입니다." },
        { status: 400 }
      );
    }

    await connectToDatabase();

    // 같은 부모 디렉토리 안에 같은 이름의 디렉토리가 이미 있는지 확인
    const filter = {
      userId: new mongoose.Types.ObjectId(userId),
      name: name.trim(),
      deleted: { $ne: true },
    };

    if (parent) {
      filter.parent = new mongoose.Types.ObjectId(parent);
    } else {
      filter.parent = null;
    }

    const existingDirectory = await Directory.findOne(filter);

    if (existingDirectory) {
      return NextResponse.json(
        { error: "같은 이름의 디렉토리가 이미 존재합니다." },
        { status: 409 }
      );
    }

    // 고유한 해시 생성
    const hash = crypto.randomBytes(16).toString("hex");

    // 경로 생성
    const path = parent ? `${userId}/${parent}/${name}` : `${userId}/${name}`;

    // 새 디렉토리 생성
    const newDirectory = new Directory({
      name: name.trim(),
      owner: new mongoose.Types.ObjectId(userId),
      parent: parent ? new mongoose.Types.ObjectId(parent) : null,
      hash,
      path,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await newDirectory.save();

    return NextResponse.json(
      {
        message: "디렉토리가 성공적으로 생성되었습니다.",
        directory: {
          id: newDirectory._id.toString(),
          name: newDirectory.name,
          hash: newDirectory.hash,
          parent: newDirectory.parent ? newDirectory.parent.toString() : null,
          createdAt: newDirectory.createdAt,
          updatedAt: newDirectory.updatedAt,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("디렉토리 생성 오류:", error);
    return NextResponse.json(
      { error: "디렉토리를 생성하는 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
