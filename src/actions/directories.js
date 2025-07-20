"use server";

import { connectToDatabase } from "@/lib/db/mongodb";
import { verifyToken } from "@/lib/auth/jwt";
import Directory from "@/models/Directory";
import File from "@/models/File";
import User from "@/models/User";
import mongoose from "mongoose";
import { cookies } from "next/headers";
import crypto from "crypto";
import { deleteObject as deleteFileFromR2 } from "@/lib/r2/r2Client";

function generateDirectoryHash() {
  return crypto.randomBytes(16).toString("hex");
}

async function getAuthenticatedUser() {
  const token = cookies().get("token")?.value;

  if (!token) {
    return null;
  }

  const decoded = await verifyToken(token);
  if (!decoded) {
    return null;
  }

  return decoded.userId;
}

export async function getDirectoryList({ parentId }) {
  try {
    const userId = await getAuthenticatedUser();

    if (!userId) {
      return { error: "인증이 필요합니다." };
    }

    await connectToDatabase();

    // 필터 조건 설정
    const filter = {
      $or: [
        { owner: new mongoose.Types.ObjectId(userId) },
        { "shared.userId": new mongoose.Types.ObjectId(userId) },
      ],
      deleted: { $ne: true },
    };

    // 특정 부모 디렉토리 내 디렉토리 조회 또는 루트 디렉토리 조회
    if (parentId) {
      filter.parent = new mongoose.Types.ObjectId(parentId);
    } else {
      filter.parent = null; // 루트 디렉토리만
    }

    // 디렉토리 조회
    const directories = await Directory.find(filter).sort({ name: 1 }).lean();

    return {
      directories: directories.map((dir) => ({
        id: dir._id.toString(),
        name: dir.name,
        hash: dir.hash,
        path: dir.path,
        parent: dir.parent ? dir.parent.toString() : null,
        isShared: dir.isShared,
        createdAt: dir.createdAt ? dir.createdAt.toISOString() : null,
        updatedAt: dir.updatedAt ? dir.updatedAt.toISOString() : null,
        deleted: dir.deleted,
        owner: dir.owner.toString() === userId,
        sharedWith:
          dir.shared?.map((share) => ({
            userId: share.userId.toString(),
            permission: share.permission,
          })) || [],
      })),
    };
  } catch (error) {
    console.error("디렉토리 목록 조회 오류:", error);
    return {
      error: "디렉토리 목록을 조회하는 중 오류가 발생했습니다.",
    };
  }
}

export async function createDirectory({ name, parentId, description }) {
  try {
    const userId = await getAuthenticatedUser();

    if (!userId) {
      return { error: "인증이 필요합니다." };
    }

    if (!name || name.trim() === "") {
      return { error: "디렉토리 이름을 입력해주세요." };
    }

    await connectToDatabase();

    // 부모 디렉토리 검증 (parentId가 있는 경우)
    if (parentId) {
      const parentDirectory = await Directory.findOne({
        _id: parentId,
        $or: [
          { owner: userId },
          {
            "shared.userId": userId,
            "shared.permission": { $in: ["write", "admin"] },
          },
        ],
      });

      if (!parentDirectory) {
        return { error: "부모 디렉토리에 접근할 수 없습니다." };
      }
    }

    // 같은 위치에 같은 이름의 디렉토리가 있는지 확인
    const existingDirectory = await Directory.findOne({
      name: name.trim(),
      parent: parentId ? new mongoose.Types.ObjectId(parentId) : null,
      owner: userId,
      deleted: { $ne: true },
    });

    if (existingDirectory) {
      return { error: "같은 이름의 디렉토리가 이미 존재합니다." };
    }

    // 새 디렉토리 생성
    const directoryHash = generateDirectoryHash();
    const directoryPath = `/${name.trim()}`;

    const directory = new Directory({
      name: name.trim(),
      description: description?.trim() || "",
      owner: userId,
      parent: parentId ? new mongoose.Types.ObjectId(parentId) : null,
      hash: directoryHash,
      path: directoryPath,
    });

    await directory.save();

    return {
      success: true,
      message: "디렉토리가 생성되었습니다.",
      directory: {
        id: directory._id.toString(),
        name: directory.name,
        description: directory.description,
        hash: directory.hash,
        path: directory.path,
        parent: directory.parent?.toString() || null,
        createdAt: directory.createdAt
          ? directory.createdAt.toISOString()
          : null,
      },
    };
  } catch (error) {
    console.error("디렉토리 생성 오류:", error);
    return { error: "디렉토리를 생성하는 중 오류가 발생했습니다." };
  }
}

export async function updateDirectory({ directoryId, name, description }) {
  try {
    const userId = await getAuthenticatedUser();

    if (!userId) {
      return { error: "인증이 필요합니다." };
    }

    if (!name || name.trim() === "") {
      return { error: "디렉토리 이름을 입력해주세요." };
    }

    await connectToDatabase();

    const directory = await Directory.findOne({
      _id: directoryId,
      $or: [
        { owner: userId },
        {
          "shared.userId": userId,
          "shared.permission": { $in: ["write", "admin"] },
        },
      ],
    });

    if (!directory) {
      return { error: "디렉토리를 찾을 수 없거나 수정 권한이 없습니다." };
    }

    // 같은 위치에 같은 이름의 다른 디렉토리가 있는지 확인
    const existingDirectory = await Directory.findOne({
      _id: { $ne: directoryId },
      name: name.trim(),
      parent: directory.parent,
      owner: directory.owner,
      deleted: { $ne: true },
    });

    if (existingDirectory) {
      return { error: "같은 이름의 디렉토리가 이미 존재합니다." };
    }

    // 디렉토리 업데이트
    directory.name = name.trim();
    if (description !== undefined) {
      directory.description = description?.trim() || "";
    }
    directory.updatedAt = new Date();

    await directory.save();

    return {
      success: true,
      message: "디렉토리가 수정되었습니다.",
      directory: {
        id: directory._id.toString(),
        name: directory.name,
        description: directory.description,
        updatedAt: directory.updatedAt
          ? directory.updatedAt.toISOString()
          : null,
      },
    };
  } catch (error) {
    console.error("디렉토리 수정 오류:", error);
    return { error: "디렉토리를 수정하는 중 오류가 발생했습니다." };
  }
}

export async function deleteDirectory({ directoryId }) {
  try {
    const userId = await getAuthenticatedUser();

    if (!userId) {
      return { error: "인증이 필요합니다." };
    }

    await connectToDatabase();

    const directory = await Directory.findOne({
      _id: directoryId,
      $or: [
        { owner: userId },
        { "shared.userId": userId, "shared.permission": "admin" },
      ],
    });

    if (!directory) {
      return { error: "디렉토리를 찾을 수 없거나 삭제 권한이 없습니다." };
    }

    // 하위 디렉토리가 있는지 확인
    const subDirectories = await Directory.find({
      parent: directoryId,
      deleted: { $ne: true },
    });

    if (subDirectories.length > 0) {
      return { error: "하위 디렉토리가 있는 디렉토리는 삭제할 수 없습니다." };
    }

    // 디렉토리 내 파일이 있는지 확인
    const filesInDirectory = await File.find({
      parentDirectory: directoryId,
      deleted: { $ne: true },
    });

    if (filesInDirectory.length > 0) {
      return { error: "파일이 있는 디렉토리는 삭제할 수 없습니다." };
    }

    // 디렉토리 소프트 삭제
    directory.deleted = true;
    directory.deletedAt = new Date();
    await directory.save();

    return {
      success: true,
      message: "디렉토리가 삭제되었습니다.",
    };
  } catch (error) {
    console.error("디렉토리 삭제 오류:", error);
    return { error: "디렉토리를 삭제하는 중 오류가 발생했습니다." };
  }
}

export async function shareDirectory({
  directoryId,
  email,
  permission = "read",
}) {
  try {
    const userId = await getAuthenticatedUser();

    if (!userId) {
      return { error: "인증이 필요합니다." };
    }

    await connectToDatabase();

    const directory = await Directory.findOne({
      _id: directoryId,
      $or: [
        { owner: userId },
        { "shared.userId": userId, "shared.permission": "admin" },
      ],
    });

    if (!directory) {
      return { error: "디렉토리를 찾을 수 없거나 공유 권한이 없습니다." };
    }

    // 공유받을 사용자 조회
    const targetUser = await User.findOne({ email });
    if (!targetUser) {
      return { error: "해당 이메일의 사용자를 찾을 수 없습니다." };
    }

    // 이미 공유된 사용자인지 확인
    const existingShare = directory.shared.find(
      (share) => share.userId.toString() === targetUser._id.toString()
    );

    if (existingShare) {
      // 권한 업데이트
      existingShare.permission = permission;
    } else {
      // 새로운 공유 추가
      directory.shared.push({
        userId: targetUser._id,
        permission,
        sharedAt: new Date(),
      });
    }

    await directory.save();

    return {
      success: true,
      message: "디렉토리가 성공적으로 공유되었습니다.",
    };
  } catch (error) {
    console.error("디렉토리 공유 오류:", error);
    return { error: "디렉토리를 공유하는 중 오류가 발생했습니다." };
  }
}

export async function getDirectoryDetails({ directoryId }) {
  try {
    const userId = await getAuthenticatedUser();

    if (!userId) {
      return { error: "인증이 필요합니다." };
    }

    await connectToDatabase();

    const directory = await Directory.findOne({
      _id: directoryId,
      $or: [{ owner: userId }, { "shared.userId": userId }],
      deleted: { $ne: true },
    }).lean();

    if (!directory) {
      return { error: "디렉토리를 찾을 수 없거나 접근 권한이 없습니다." };
    }

    // 하위 디렉토리 개수
    const subDirectoryCount = await Directory.countDocuments({
      parent: directoryId,
      deleted: { $ne: true },
    });

    // 디렉토리 내 파일 개수
    const fileCount = await File.countDocuments({
      parentDirectory: directoryId,
      deleted: { $ne: true },
    });

    return {
      success: true,
      directory: {
        id: directory._id.toString(),
        name: directory.name,
        path: directory.path,
        parent: directory.parent ? directory.parent.toString() : null,
        isShared: directory.isShared,
        createdAt: directory.createdAt
          ? directory.createdAt.toISOString()
          : null,
        updatedAt: directory.updatedAt
          ? directory.updatedAt.toISOString()
          : null,
        deleted: directory.deleted,
        owner: directory.owner.toString() === userId,
        subDirectoryCount,
        fileCount,
        sharedWith:
          directory.shared?.map((share) => ({
            userId: share.userId.toString(),
            permission: share.permission,
            sharedAt: share.sharedAt ? share.sharedAt.toISOString() : null,
          })) || [],
      },
    };
  } catch (error) {
    console.error("디렉토리 상세 정보 조회 오류:", error);
    return { error: "디렉토리 정보를 조회하는 중 오류가 발생했습니다." };
  }
}

export async function getDirectoryByHash({ hash }) {
  try {
    const userId = await getAuthenticatedUser();

    if (!userId) {
      return { error: "인증이 필요합니다." };
    }

    await connectToDatabase();

    const directory = await Directory.findOne({
      hash: hash,
      $or: [{ owner: userId }, { "shared.userId": userId }],
      deleted: { $ne: true },
    }).lean();

    if (!directory) {
      return { error: "디렉토리를 찾을 수 없거나 접근 권한이 없습니다." };
    }

    // 하위 디렉토리 개수
    const subDirectoryCount = await Directory.countDocuments({
      parent: directory._id,
      deleted: { $ne: true },
    });

    // 디렉토리 내 파일 개수
    const fileCount = await File.countDocuments({
      parentDirectory: directory._id,
      deleted: { $ne: true },
    });

    return {
      success: true,
      directory: {
        id: directory._id.toString(),
        name: directory.name,
        description: directory.description,
        path: directory.path,
        parent: directory.parent ? directory.parent.toString() : null,
        isShared: directory.isShared,
        createdAt: directory.createdAt
          ? directory.createdAt.toISOString()
          : null,
        updatedAt: directory.updatedAt
          ? directory.updatedAt.toISOString()
          : null,
        deleted: directory.deleted,
        owner: directory.owner.toString() === userId,
        subDirectoryCount,
        fileCount,
        sharedWith:
          directory.shared?.map((share) => ({
            userId: share.userId.toString(),
            permission: share.permission,
            sharedAt: share.sharedAt ? share.sharedAt.toISOString() : null,
          })) || [],
      },
    };
  } catch (error) {
    console.error("디렉토리 해시 조회 오류:", error);
    return { error: "디렉토리 정보를 조회하는 중 오류가 발생했습니다." };
  }
}

export async function deleteDirectoryRecursive({ directoryId }) {
  try {
    const userId = await getAuthenticatedUser();

    if (!userId) {
      return { error: "인증이 필요합니다." };
    }

    await connectToDatabase();

    const directory = await Directory.findOne({
      _id: directoryId,
      owner: userId, // 재귀 삭제는 소유자만 가능
    });

    if (!directory) {
      return { error: "디렉토리를 찾을 수 없거나 삭제 권한이 없습니다." };
    }

    // 재귀적으로 하위 항목들을 삭제하는 함수
    async function deleteRecursively(dirId) {
      // 하위 디렉토리들 찾기
      const subDirectories = await Directory.find({
        parent: dirId,
        deleted: { $ne: true },
      });

      // 각 하위 디렉토리에 대해 재귀 호출
      for (const subDir of subDirectories) {
        await deleteRecursively(subDir._id);
      }

      // 현재 디렉토리의 파일들 삭제
      const files = await File.find({
        parentDirectory: dirId,
        deleted: { $ne: true },
      });

      for (const file of files) {
        // R2에서 파일 삭제
        try {
          await deleteFileFromR2(file.fileName);
        } catch (r2Error) {
          console.error("R2 파일 삭제 오류:", r2Error);
          // R2 삭제 실패는 로그만 남기고 계속 진행
        }

        // DB에서 파일 삭제 (소프트 삭제)
        file.deleted = true;
        file.deletedAt = new Date();
        await file.save();

        // 소유자의 저장소 사용량 업데이트
        if (file.owner.toString() === userId) {
          const sizeToDecrement =
            file.isEncrypted && file.originalSize
              ? file.originalSize
              : file.size;
          await User.findByIdAndUpdate(userId, {
            $inc: { storageUsed: -sizeToDecrement },
          });
        }
      }

      // 현재 디렉토리 삭제
      await Directory.findByIdAndUpdate(dirId, {
        deleted: true,
        deletedAt: new Date(),
      });
    }

    await deleteRecursively(directoryId);

    return {
      success: true,
      message: "디렉토리와 모든 하위 항목이 삭제되었습니다.",
    };
  } catch (error) {
    console.error("디렉토리 재귀 삭제 오류:", error);
    return { error: "디렉토리를 삭제하는 중 오류가 발생했습니다." };
  }
}

// 디렉토리 공유 링크 생성
export async function createDirectoryShareLink({
  directoryId,
  permission = "read",
  expiresIn = 7,
}) {
  try {
    const userId = await getAuthenticatedUser();

    if (!userId) {
      return { error: "인증이 필요합니다." };
    }

    await connectToDatabase();

    const directory = await Directory.findById(directoryId);
    if (!directory) {
      return { error: "디렉토리를 찾을 수 없습니다." };
    }

    // 디렉토리 소유자 또는 관리자 권한 확인
    const hasPermission =
      directory.owner.toString() === userId ||
      directory.shared.some(
        (share) =>
          share.userId.toString() === userId &&
          (share.permission === "admin" || share.permission === "write")
      );

    if (!hasPermission) {
      return { error: "디렉토리를 공유할 권한이 없습니다." };
    }

    // 공유 링크용 해시 생성 (기존 해시와 다름)
    const shareHash = crypto.randomBytes(20).toString("hex");

    // 만료 시간 계산
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresIn);

    // 디렉토리에 공유 정보 추가
    directory.shareLinks = directory.shareLinks || [];
    directory.shareLinks.push({
      hash: shareHash,
      permission,
      expiresAt,
      createdBy: userId,
      createdAt: new Date(),
    });

    await directory.save();

    const shareUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/share/directory/${shareHash}`;

    return {
      success: true,
      shareUrl,
      shareHash,
      expiresAt: expiresAt.toISOString(),
      permission,
    };
  } catch (error) {
    console.error("디렉토리 공유 링크 생성 오류:", error);
    return { error: "공유 링크 생성 중 오류가 발생했습니다." };
  }
}

// 디렉토리 공유 링크 목록 조회
export async function getDirectoryShareLinks({ directoryId }) {
  try {
    const userId = await getAuthenticatedUser();

    if (!userId) {
      return { error: "인증이 필요합니다." };
    }

    await connectToDatabase();

    const directory = await Directory.findById(directoryId);
    if (!directory) {
      return { error: "디렉토리를 찾을 수 없습니다." };
    }

    // 디렉토리 소유자 또는 관리자 권한 확인
    const hasPermission =
      directory.owner.toString() === userId ||
      directory.shared.some(
        (share) =>
          share.userId.toString() === userId && share.permission === "admin"
      );

    if (!hasPermission) {
      return { error: "공유 링크를 조회할 권한이 없습니다." };
    }

    const shareLinks = (directory.shareLinks || []).map((link) => ({
      hash: link.hash,
      permission: link.permission,
      expiresAt: link.expiresAt,
      createdAt: link.createdAt,
      shareUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/share/directory/${link.hash}`,
      expired: new Date() > link.expiresAt,
    }));

    return {
      success: true,
      shareLinks,
    };
  } catch (error) {
    console.error("디렉토리 공유 링크 조회 오류:", error);
    return { error: "공유 링크를 조회하는 중 오류가 발생했습니다." };
  }
}

// 디렉토리 공유 링크 삭제
export async function deleteDirectoryShareLink({ directoryId, shareHash }) {
  try {
    const userId = await getAuthenticatedUser();

    if (!userId) {
      return { error: "인증이 필요합니다." };
    }

    await connectToDatabase();

    const directory = await Directory.findById(directoryId);
    if (!directory) {
      return { error: "디렉토리를 찾을 수 없습니다." };
    }

    // 디렉토리 소유자 또는 관리자 권한 확인
    const hasPermission =
      directory.owner.toString() === userId ||
      directory.shared.some(
        (share) =>
          share.userId.toString() === userId && share.permission === "admin"
      );

    if (!hasPermission) {
      return { error: "공유 링크를 삭제할 권한이 없습니다." };
    }

    // 공유 링크 제거
    directory.shareLinks = (directory.shareLinks || []).filter(
      (link) => link.hash !== shareHash
    );

    await directory.save();

    return {
      success: true,
      message: "공유 링크가 삭제되었습니다.",
    };
  } catch (error) {
    console.error("디렉토리 공유 링크 삭제 오류:", error);
    return { error: "공유 링크 삭제 중 오류가 발생했습니다." };
  }
}
