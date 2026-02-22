"use server";

import { connectToDatabase } from "@/lib/db/mongodb";
import { requireAuthenticatedUser } from "@/lib/auth/serverAuth";
import { breadcrumbsCache } from "@/lib/cache";
import Directory from "@/models/Directory";
import File from "@/models/File";
import User from "@/models/User";
import mongoose from "mongoose";
import crypto from "crypto";
import { deleteObject as deleteFileFromR2 } from "@/lib/r2/r2Client";
import { dir } from "console";

function generateDirectoryHash() {
  return crypto.randomBytes(16).toString("hex");
}


export async function getDirectoryList({
  parentId,
  page = 1,
  limit = 20,
  sortBy = "name",
  sortOrder = "asc",
  shareLinkHash = null,
}) {
  try {
    const userId = await requireAuthenticatedUser();

    if (!userId) {
      return { error: "로그인이 필요합니다." };
    }

    await connectToDatabase();

    // 부모 디렉토리 권한 확인 및 접근 권한 설정
    let hasParentAccess = false;
    if (parentId) {
      // 부모 디렉토리 권한 확인
      const parentDirectory = await Directory.findOne({
        _id: parentId,
        $or: [
          { owner: new mongoose.Types.ObjectId(userId) },
          {
            "shared": {
              $elemMatch: {
                "userId": new mongoose.Types.ObjectId(userId),
              },
            },
          },
          // 공유 링크 접근 권한 확인
          { shareLinks: { $elemMatch: { hash: shareLinkHash } } },
        ],
        deleted: { $ne: true },
      });

      if (parentDirectory) {
        hasParentAccess = true;
      }
    }

    // 필터 조건 설정 (부모 디렉토리 접근 권한이 있으면 하위 디렉토리 모두 조회)
    let filter;
    if (parentId && hasParentAccess) {
      // 부모 디렉토리에 권한이 있으면 해당 디렉토리의 모든 하위 디렉토리에 접근 가능
      filter = {
        parent: new mongoose.Types.ObjectId(parentId),
        deleted: { $ne: true },
      };
    } else if (parentId) {
      // parentId가 있지만 권한이 없는 경우 (위에서 이미 에러 반환)
      filter = {
        $or: [
          { owner: new mongoose.Types.ObjectId(userId) },
          {
            "shared": {
              $elemMatch: {
                "userId": new mongoose.Types.ObjectId(userId),
              },
            },
          },
          // 공유 링크 접근 권한 확인
          { shareLinks: { $elemMatch: { hash: shareLinkHash } } },
        ],
        parent: new mongoose.Types.ObjectId(parentId),
        deleted: { $ne: true },
      };
    } else {
      // 루트 디렉토리의 경우 소유자이거나 공유받은 디렉토리만
      filter = {
        $or: [
          { owner: new mongoose.Types.ObjectId(userId) },
          {
            "shared": {
              $elemMatch: {
                "userId": new mongoose.Types.ObjectId(userId),
              },
            },
          },
          // 공유 링크 접근 권한 확인
          { shareLinks: { $elemMatch: { hash: shareLinkHash } } },
        ],
        parent: null,
        deleted: { $ne: true },
      };
    }

    // 디렉토리 조회 (공유자 정보 포함)
    let dirQuery = Directory.find(filter)
      .populate({
        path: "owner",
        select: "name email",
      })
      .populate({
        path: "shared.userId",
        select: "name email",
      })
      .sort({ [sortBy]: sortOrder === "asc" ? 1 : -1 })
      .lean();

    // limit > 0인 경우에만 페이지네이션 적용 (limit=0이면 전체 조회)
    if (limit > 0) {
      dirQuery = dirQuery.skip((page - 1) * limit).limit(limit);
    }

    const directories = await dirQuery;

    // 디렉토리 개수 조회
    const totalDirectories = await Directory.countDocuments(filter);

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
        owner: dir.owner._id.toString() === userId,
        ownerInfo: {
          id: dir.owner._id.toString(),
          name: dir.owner.name,
          email: dir.owner.email,
        },
        sharedWith:
          dir.shared?.map((share) => ({
            _id: share._id.toString(),
            userId: share.userId._id.toString(),
            user: {
              name: share.userId.name,
              email: share.userId.email,
            },
            permission: share.permission,
          })) || [],
      })),
      pagination: {
        totalDirectories,
        currentPage: page,
        limit,
      },
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
    const userId = await requireAuthenticatedUser();

    if (!userId) {
      return { error: "로그인이 필요합니다." };
    }

    if (!name || name.trim() === "") {
      return { error: "디렉토리 이름을 입력해주세요." };
    }
    if (name.length > 100) {
      return { error: "디렉토리 이름은 100자 이내로 입력해주세요." };
    }
    if (description && description.length > 500) {
      return { error: "디렉토리 설명은 500자 이내로 입력해주세요." };
    }

    await connectToDatabase();
    const user = await User.findById(userId);
    if (!user) {
      return { error: "사용자를 찾을 수 없습니다." };
    }
    if (user.suspended) {
      return { error: "정지된 사용자입니다." };
    }

    // 부모 디렉토리 검증 (parentId가 있는 경우)
    if (parentId) {
      const parentDirectory = await Directory.findOne({
        _id: parentId,
        $or: [
          { owner: userId },
          {
            "shared": {
              $elemMatch: {
                "userId": new mongoose.Types.ObjectId(userId),
                "permission": { $in: ["write", "admin"] },
              },
            },
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
    const userId = await requireAuthenticatedUser();

    if (!userId) {
      return { error: "로그인이 필요합니다." };
    }

    if (!name || name.trim() === "") {
      return { error: "디렉토리 이름을 입력해주세요." };
    }

    await connectToDatabase();

    const user = await User.findById(userId);
    if (!user) {
      return { error: "사용자를 찾을 수 없습니다." };
    }
    if (user.suspended) {
      return { error: "정지된 사용자입니다." };
    }

    const directory = await Directory.findOne({
      _id: directoryId,
      $or: [
        { owner: userId },
        {
          "shared": {
            $elemMatch: {
              "userId": new mongoose.Types.ObjectId(userId),
              "permission": "admin",
            },
          },
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
        hash: directory.hash, // hash 값 추가
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

export async function deleteDirectory(directoryId) {
  try {
    const userId = await requireAuthenticatedUser();

    if (!userId) {
      return { error: "로그인이 필요합니다." };
    }

    await connectToDatabase();

    const user = await User.findById(userId);
    if (!user) {
      return { error: "사용자를 찾을 수 없습니다." };
    }
    if (user.suspended) {
      return { error: "정지된 사용자입니다." };
    }

    // 디렉토리 조회
    const directory = await Directory.findOne({
      _id: directoryId,
    });
    console.log("디렉토리 삭제 대상 ID:", directoryId);

    if (!directory) {
      return { error: "디렉토리를 찾을 수 없습니다." };
    }

    // 디렉토리 삭제 권한 확인
    const isOwner = directory.owner.toString() === userId;
    const hasDirectAdminAccess = directory.shared?.some(
      (share) =>
        share.userId.toString() === userId && share.permission === "admin",
    );

    // 상위 디렉토리 권한 확인
    let hasParentAdminAccess = false;
    if (directory.parent) {
      const parentDirectory = await Directory.findOne({
        _id: directory.parent,
        $or: [
          { owner: new mongoose.Types.ObjectId(userId) },
          {
            "shared": {
              $elemMatch: {
                "userId": new mongoose.Types.ObjectId(userId),
                "permission": "admin",
              },
            },
          },
        ],
        deleted: { $ne: true },
      });

      if (parentDirectory) {
        hasParentAdminAccess = true;
      }
    }

    // 삭제 권한 검증
    if (!isOwner && !hasDirectAdminAccess && !hasParentAdminAccess) {
      return { error: "디렉토리를 삭제할 권한이 없습니다." };
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
    const userId = await requireAuthenticatedUser();

    if (!userId) {
      return { error: "로그인이 필요합니다." };
    }

    await connectToDatabase();

    const user = await User.findById(userId);
    if (!user) {
      return { error: "사용자를 찾을 수 없습니다." };
    }
    if (user.suspended) {
      return { error: "정지된 사용자입니다." };
    }

    const directory = await Directory.findOne({
      _id: directoryId,
      $or: [
        { owner: userId },
        {
          "shared": {
            $elemMatch: {
              "userId": new mongoose.Types.ObjectId(userId),
              "permission": "admin",
            },
          },
        },
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

    // 소유자가 자신에게 공유하려고 시도하는지 확인
    if (directory.owner.toString() === targetUser._id.toString()) {
      return { error: "디렉토리 소유자는 본인에게 공유할 수 없습니다." };
    }

    // 이미 공유된 사용자인지 확인
    const existingShare = directory.shared.find(
      (share) => share.userId.toString() === targetUser._id.toString(),
    );

    if (existingShare) {
      // 권한 업데이트
      existingShare.permission = permission;
    } else {
      // 새로운 공유 추가
      directory.shared.push({
        userId: targetUser._id,
        permission,
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

// 디렉토리 공유 취소
export async function unshareDirectory({ directoryId, targetUserId }) {
  try {
    const userId = await requireAuthenticatedUser();

    if (!userId) {
      return { error: "로그인이 필요합니다." };
    }

    await connectToDatabase();

    const user = await User.findById(userId);
    if (!user) {
      return { error: "사용자를 찾을 수 없습니다." };
    }
    if (user.suspended) {
      return { error: "정지된 사용자입니다." };
    }

    const directory = await Directory.findOne({
      _id: directoryId,
      $or: [
        { owner: userId },
        {
          "shared": {
            $elemMatch: {
              "userId": new mongoose.Types.ObjectId(userId),
              "permission": "admin",
            },
          },
        },
      ],
    });

    if (!directory) {
      return { error: "디렉토리를 찾을 수 없거나 공유 취소 권한이 없습니다." };
    }
    console.log("디렉토리 공유 취소 대상 사용자 ID:", targetUserId);
    console.log("디렉토리 공유 대상 사용자 목록:", directory.shared);
    // 공유 제거
    directory.shared = directory.shared.filter(
      (share) => share.userId.toString() !== targetUserId,
    );

    await directory.save();

    return {
      success: true,
      message: "공유가 취소되었습니다.",
    };
  } catch (error) {
    console.error("디렉토리 공유 취소 오류:", error);
    return { error: "공유를 취소하는 중 오류가 발생했습니다." };
  }
}

// 디렉토리 공유 사용자 목록 조회
export async function getDirectorySharedUsers({ directoryId }) {
  try {
    const userId = await requireAuthenticatedUser();

    if (!userId) {
      return { error: "로그인이 필요합니다." };
    }

    await connectToDatabase();

    const directory = await Directory.findOne({
      _id: directoryId,
      $or: [
        { owner: userId },
        {
          "shared": {
            $elemMatch: {
              "userId": new mongoose.Types.ObjectId(userId),
              "permission": "admin",
            },
          },
        },
      ],
    }).populate("shared.userId", "name email");
    if (!directory) {
      return { error: "디렉토리를 찾을 수 없거나 조회 권한이 없습니다." };
    }

    const sharedUsers = directory.shared.map((share) => ({
      _id: share._id.toString(),
      userId: share.userId._id.toString(),
      user: {
        name: share.userId.name,
        email: share.userId.email,
      },
      permission: share.permission,
    }));
    return {
      success: true,
      users: sharedUsers,
    };
  } catch (error) {
    console.error("디렉토리 공유 사용자 조회 오류:", error);
    return { error: "공유 사용자 목록을 조회하는 중 오류가 발생했습니다." };
  }
}

export async function getDirectoryDetails({ directoryId }) {
  try {
    const userId = await requireAuthenticatedUser();

    if (!userId) {
      return { error: "로그인이 필요합니다." };
    }

    await connectToDatabase();

    const directory = await Directory.findOne({
      _id: directoryId,
      $or: [
        { owner: userId },
        {
          "shared": {
            $elemMatch: {
              "userId": new mongoose.Types.ObjectId(userId),
            },
          },
        },
      ],
      deleted: { $ne: true },
    })
      .populate({
        path: "shared.userId",
        select: "name email",
      })
      .lean();

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
            _id: share._id.toString(),
            userId: share.userId._id.toString(),
            user: {
              name: share.userId.name,
              email: share.userId.email,
            },
            permission: share.permission,
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
    const userId = await requireAuthenticatedUser();

    if (!userId) {
      return { error: "로그인이 필요합니다." };
    }

    await connectToDatabase();
    console.log("디렉토리 해시 조회 대상 해시:", hash);
    console.log("사용자 ID:", userId);

    // 디렉토리 조회
    const directory = await Directory.findOne({
      hash: hash,
      deleted: { $ne: true },
    })
      .populate({
        path: "owner",
        select: "name email",
      })
      .populate({
        path: "shared.userId",
        select: "name email",
      })
      .lean();

    console.log("쿼리 결과:", directory);
    console.log("검색 조건:", { hash, userId });

    if (!directory) {
      return { error: "디렉토리를 찾을 수 없습니다." };
    }

    // 디렉토리 접근 권한 확인
    const isOwner = directory.owner._id.toString() === userId;
    const isDirectlyShared = directory.shared?.some((share) => {
      // Handle both populated and non-populated userId
      const shareUserId = share.userId._id
        ? share.userId._id.toString()
        : share.userId.toString();
      return shareUserId === userId;
    });
    // 최상위 디렉토리 권한 확인
    let hasParentAccess = false;
    let hasParentAdminAccess = false;
    let currentDirectory = directory;
    // 상위 디렉토리로 올라가며 권한 확인
    while (currentDirectory && currentDirectory.parent) {
      const parentDirectory = await Directory.findOne({
        _id: currentDirectory.parent,
        $or: [
          { owner: new mongoose.Types.ObjectId(userId) },
          {
            "shared": {
              $elemMatch: {
                "userId": new mongoose.Types.ObjectId(userId),
              },
            },
          },
        ],
        deleted: { $ne: true },
      });
      if (!parentDirectory) {
        break; // 상위 디렉토리가 없으면 중단
      }
      // 상위 디렉토리 접근 권한 확인
      if (
        parentDirectory.owner._id.toString() === userId ||
        parentDirectory.shared.some(
          (share) => share.userId._id.toString() === userId,
        )
      ) {
        if (
          parentDirectory.owner._id.toString() === userId ||
          parentDirectory.shared.some(
            (share) =>
              share.userId._id.toString() === userId &&
              share.permission === "admin",
          )
        ) {
          hasParentAdminAccess = true; // 상위 디렉토리에서 admin 권한이 있는 경우
        }
        hasParentAccess = true;
        break; // 상위 디렉토리에 접근 권한이 있으면 중단
      }
      currentDirectory = parentDirectory; // 상위 디렉토리로 이동
    }

    console.log("상위 디렉토리 접근 권한 여부:", hasParentAccess);

    // 접근 권한 검증
    if (!isOwner && !isDirectlyShared && !hasParentAccess) {
      return { error: "디렉토리에 접근할 권한이 없습니다." };
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
        hash: directory.hash,
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
        owner:
          directory.owner._id.toString() === userId || hasParentAdminAccess,
        ownerInfo: {
          id: directory.owner._id.toString(),
          name: directory.owner.name,
          email: directory.owner.email,
        },
        subDirectoryCount,
        fileCount,
        sharedWith:
          directory.shared?.map((share) => ({
            _id: share._id.toString(),
            userId: share.userId._id.toString(),
            user: {
              name: share.userId.name,
              email: share.userId.email,
            },
            permission: share.permission,
          })) || [],
      },
    };
  } catch (error) {
    console.error("디렉토리 해시 조회 오류:", error);
    return { error: "디렉토리 정보를 조회하는 중 오류가 발생했습니다." };
  }
}

export async function deleteDirectoryRecursive(directoryId) {
  try {
    const userId = await requireAuthenticatedUser();

    if (!userId) {
      return { error: "로그인이 필요합니다." };
    }

    await connectToDatabase();

    const user = await User.findById(userId);
    if (!user) {
      return { error: "사용자를 찾을 수 없습니다." };
    }
    if (user.suspended) {
      return { error: "정지된 사용자입니다." };
    }
    const directory = await Directory.findOne({
      _id: directoryId,
    });
    let permissionCheck = false;
    if (directory) {
      if (
        directory.owner.toString() === userId ||
        directory.shared.some(
          (share) =>
            share.userId.toString() === userId &&
            (share.permission === "admin" || share.permission === "write"),
        )
      ) {
        permissionCheck = true;
      }
      // 최상위 부모 디렉토리 삭제 권한 확인
      // 상위 디렉토리로 올라가며 parent가 null이 될 때까지 확인
      if (!permissionCheck && directory && directory.parent) {
        let currentDirectory = directory;
        while (currentDirectory.parent) {
          const parentDirectory = await Directory.findById(
            currentDirectory.parent,
          );
          if (!parentDirectory) {
            return { error: "상위 디렉토리를 찾을 수 없습니다." };
          }
          if (
            parentDirectory.parent === null &&
            (parentDirectory.owner.toString() === userId ||
              parentDirectory.shared.some(
                (share) =>
                  share.userId.toString() === userId &&
                  (share.permission === "admin" ||
                    share.permission === "write"),
              ))
          ) {
            permissionCheck = true;
            break;
          }
          currentDirectory = parentDirectory;
        }
      }
    }

    if (!permissionCheck) {
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
    const userId = await requireAuthenticatedUser();

    if (!userId) {
      return { error: "로그인이 필요합니다." };
    }

    await connectToDatabase();

    const user = await User.findById(userId);
    if (!user) {
      return { error: "사용자를 찾을 수 없습니다." };
    }
    if (user.suspended) {
      return { error: "정지된 사용자입니다." };
    }

    const directory = await Directory.findById(directoryId);
    if (!directory) {
      return { error: "디렉토리를 찾을 수 없습니다." };
    }

    // 디렉토리 소유자 또는 관리자 권한 확인
    const hasPermission =
      directory.owner.toString() === userId ||
      directory.shared.some(
        (share) =>
          share.userId.toString() === userId && share.permission === "admin",
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
    const userId = await requireAuthenticatedUser();

    if (!userId) {
      return { error: "로그인이 필요합니다." };
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
          share.userId.toString() === userId && share.permission === "admin",
      );

    if (!hasPermission) {
      return { error: "공유 링크를 조회할 권한이 없습니다." };
    }

    const shareLinks = (directory.shareLinks || []).map((link) => ({
      hash: link.hash,
      permission: link.permission,
      expiresAt: link.expiresAt,
      createdAt: link.createdAt,
      shareUrl: `${process.env.NEXT_PUBLIC_APP_URL}/share/directory/${link.hash}`,
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
    const userId = await requireAuthenticatedUser();

    if (!userId) {
      return { error: "로그인이 필요합니다." };
    }

    await connectToDatabase();

    const user = await User.findById(userId);
    if (!user) {
      return { error: "사용자를 찾을 수 없습니다." };
    }
    if (user.suspended) {
      return { error: "정지된 사용자입니다." };
    }

    const directory = await Directory.findById(directoryId);
    if (!directory) {
      return { error: "디렉토리를 찾을 수 없습니다." };
    }

    // 디렉토리 소유자 또는 관리자 권한 확인
    const hasPermission =
      directory.owner.toString() === userId ||
      directory.shared.some(
        (share) =>
          share.userId.toString() === userId && share.permission === "admin",
      );

    if (!hasPermission) {
      return { error: "공유 링크를 삭제할 권한이 없습니다." };
    }

    // 공유 링크 제거
    directory.shareLinks = (directory.shareLinks || []).filter(
      (link) => link.hash !== shareHash,
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

// 공유 링크로 디렉토리 접근
export async function getSharedDirectory({ shareHash }) {
  try {
    await connectToDatabase();

    const directory = await Directory.findOne({
      "shareLinks.hash": shareHash,
      deleted: { $ne: true },
    }).lean();

    if (!directory) {
      return { error: "공유 링크가 유효하지 않습니다." };
    }

    // 해당 공유 링크 찾기
    const shareLink = directory.shareLinks.find(
      (link) => link.hash === shareHash,
    );

    if (!shareLink) {
      return { error: "공유 링크를 찾을 수 없습니다." };
    }

    // 만료 확인
    if (new Date() > shareLink.expiresAt) {
      return { error: "공유 링크가 만료되었습니다." };
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
        hash: directory.hash,
        createdAt: directory.createdAt
          ? directory.createdAt.toISOString()
          : null,
        subDirectoryCount,
        fileCount,
        permission: shareLink.permission, // 공유 링크의 권한
        isSharedAccess: true,
      },
    };
  } catch (error) {
    console.error("공유 디렉토리 조회 오류:", error);
    return { error: "공유 디렉토리를 조회하는 중 오류가 발생했습니다." };
  }
}

// 공유 링크로 디렉토리 내 파일 목록 조회
export async function getSharedDirectoryFiles({
  shareHash,
  page = 1,
  limit = 50,
}) {
  try {
    await connectToDatabase();

    const directory = await Directory.findOne({
      "shareLinks.hash": shareHash,
      deleted: { $ne: true },
    }).lean();

    if (!directory) {
      return { error: "공유 링크가 유효하지 않습니다." };
    }

    // 해당 공유 링크 찾기
    const shareLink = directory.shareLinks.find(
      (link) => link.hash === shareHash,
    );

    if (!shareLink) {
      return { error: "공유 링크를 찾을 수 없습니다." };
    }

    // 만료 확인
    if (new Date() > shareLink.expiresAt) {
      return { error: "공유 링크가 만료되었습니다." };
    }

    // 파일 목록 조회
    const skip = (page - 1) * limit;
    const files = await File.find({
      parentDirectory: directory._id,
      deleted: { $ne: true },
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const totalFiles = await File.countDocuments({
      parentDirectory: directory._id,
      deleted: { $ne: true },
    });

    const totalPages = Math.ceil(totalFiles / limit);

    return {
      success: true,
      files: files.map((file) => ({
        id: file._id.toString(),
        originalName: file.originalName,
        fileName: file.fileName,
        size: file.size,
        mimetype: file.mimetype,
        hash: file.hash,
        isEncrypted: file.isEncrypted || false,
        originalSize: file.originalSize,
        originalMimetype: file.originalMimetype,
        createdAt: file.createdAt ? file.createdAt.toISOString() : null,
        updatedAt: file.updatedAt ? file.updatedAt.toISOString() : null,
        canDownload: true, // 공유 링크로는 기본적으로 다운로드 가능
      })),
      pagination: {
        page,
        limit,
        totalFiles,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
      directoryPermission: shareLink.permission,
    };
  } catch (error) {
    console.error("공유 디렉토리 파일 목록 조회 오류:", error);
    return { error: "파일 목록을 조회하는 중 오류가 발생했습니다." };
  }
}

export async function removeDirectoryShare({ directoryId, shareId }) {
  try {
    const userId = await requireAuthenticatedUser();

    if (!userId) {
      return { error: "로그인이 필요합니다." };
    }

    await connectToDatabase();

    const user = await User.findById(userId);
    if (!user) {
      return { error: "사용자를 찾을 수 없습니다." };
    }
    if (user.suspended) {
      return { error: "정지된 사용자입니다." };
    }

    // 디렉토리 조회 및 권한 확인
    const directory = await Directory.findById(directoryId);

    if (!directory) {
      return { error: "디렉토리를 찾을 수 없습니다." };
    }

    // 디렉토리 소유자이거나 관리자 권한이 있는지 확인
    const isOwner = directory.owner.toString() === userId;
    const hasAdminPermission = directory.shared.some(
      (share) =>
        share.userId.toString() === userId && share.permission === "admin",
    );

    if (!isOwner && !hasAdminPermission) {
      return { error: "공유를 해제할 권한이 없습니다." };
    }

    // 공유 제거
    await Directory.findByIdAndUpdate(directoryId, {
      $pull: { shared: { _id: shareId } },
    });

    return { message: "공유가 해제되었습니다." };
  } catch (error) {
    console.error("디렉토리 공유 해제 오류:", error);
    return { error: "디렉토리 공유 해제 중 오류가 발생했습니다." };
  }
}

// 디렉토리의 breadcrumbs 경로를 가져오는 함수
export async function getDirectoryBreadcrumbs({ directoryId }) {
  try {
    const userId = await requireAuthenticatedUser();

    if (!userId) {
      return { error: "로그인이 필요합니다." };
    }

    const cacheKey = `${userId}:${directoryId || "root"}`;
    const cachedBreadcrumbs = breadcrumbsCache.get(cacheKey);
    if (cachedBreadcrumbs) {
      return {
        success: true,
        breadcrumbs: cachedBreadcrumbs,
      };
    }

    await connectToDatabase();

    const breadcrumbs = [];
    let currentDirectoryId = directoryId;

    // 루트까지 역순으로 탐색
    while (currentDirectoryId) {
      const directory = await Directory.findById(currentDirectoryId)
        .populate("owner", "name email")
        .lean();

      if (!directory || directory.deleted) {
        break;
      }

      // 접근 권한 확인
      const isOwner = directory.owner._id.toString() === userId;
      const isShared = directory.shared?.some(
        (share) => share.userId.toString() === userId,
      );

      if (!isOwner && !isShared) {
        break; // 권한이 없으면 여기서 중단
      }

      // breadcrumb 항목 추가 (역순이므로 앞에 추가)
      breadcrumbs.unshift({
        id: directory._id.toString(),
        name: directory.name,
        hash: directory.hash,
        isOwner,
      });

      // 다음 상위 디렉토리로 이동
      currentDirectoryId = directory.parent;
    }

    const response = {
      success: true,
      breadcrumbs,
    };

    breadcrumbsCache.set(cacheKey, breadcrumbs);
    return response;
  } catch (error) {
    console.error("breadcrumbs 조회 오류:", error);
    return { error: "경로 정보를 가져오는 중 오류가 발생했습니다." };
  }
}

// 디렉토리 이동 (상위 디렉토리 변경)
export async function moveDirectory({ directoryId, targetParentId }) {
  try {
    const userId = await requireAuthenticatedUser();
    if (!userId) return { error: "로그인이 필요합니다." };

    await connectToDatabase();

    const directory = await Directory.findOne({
      _id: directoryId,
      owner: new mongoose.Types.ObjectId(userId),
      deleted: { $ne: true },
    });
    if (!directory) return { error: "디렉토리를 찾을 수 없습니다." };

    // 자기 자신으로 이동 방지
    if (targetParentId && targetParentId === directoryId) {
      return { error: "디렉토리를 자기 자신 안으로 이동할 수 없습니다." };
    }

    // 하위 디렉토리로 이동 방지 (순환 참조)
    if (targetParentId) {
      let currentId = targetParentId;
      while (currentId) {
        if (currentId === directoryId) {
          return { error: "하위 디렉토리로 이동할 수 없습니다." };
        }
        const parentDir = await Directory.findById(currentId);
        currentId = parentDir?.parent?.toString() || null;
      }

      const targetDir = await Directory.findOne({
        _id: targetParentId,
        owner: new mongoose.Types.ObjectId(userId),
        deleted: { $ne: true },
      });
      if (!targetDir) return { error: "대상 디렉토리를 찾을 수 없습니다." };
      directory.parent = new mongoose.Types.ObjectId(targetParentId);
    } else {
      directory.parent = null;
    }

    directory.updatedAt = new Date();
    await directory.save();

    return { success: true, message: "디렉토리가 이동되었습니다." };
  } catch (error) {
    console.error("디렉토리 이동 오류:", error);
    return { error: "디렉토리 이동 중 오류가 발생했습니다." };
  }
}

// 사용자의 모든 디렉토리 목록 (이동 대상 선택용)
export async function getAllDirectoriesFlat() {
  try {
    const userId = await requireAuthenticatedUser();
    if (!userId) return { error: "로그인이 필요합니다." };

    await connectToDatabase();

    const directories = await Directory.find({
      owner: new mongoose.Types.ObjectId(userId),
      deleted: { $ne: true },
    })
      .sort({ name: 1 })
      .lean();

    // 경로 생성을 위한 맵
    const dirMap = new Map();
    directories.forEach((d) => {
      dirMap.set(d._id.toString(), d);
    });

    const getFullPath = (dir) => {
      const parts = [dir.name];
      let current = dir;
      while (current.parent) {
        const parent = dirMap.get(current.parent.toString());
        if (!parent) break;
        parts.unshift(parent.name);
        current = parent;
      }
      return parts.join(" / ");
    };

    return {
      success: true,
      directories: directories.map((d) => ({
        id: d._id.toString(),
        name: d.name,
        parentId: d.parent?.toString() || null,
        fullPath: getFullPath(d),
      })),
    };
  } catch (error) {
    console.error("전체 디렉토리 목록 오류:", error);
    return { error: "디렉토리 목록을 불러오는 중 오류가 발생했습니다." };
  }
}

// 벌크 디렉토리 이동
export async function bulkMoveDirectories({ directoryIds, targetParentId }) {
  try {
    const userId = await requireAuthenticatedUser();
    if (!userId) return { error: "로그인이 필요합니다." };
    if (!directoryIds || directoryIds.length === 0)
      return { error: "이동할 디렉토리를 선택해주세요." };

    await connectToDatabase();

    // 대상 디렉토리 검증
    if (targetParentId) {
      const targetDir = await Directory.findOne({
        _id: targetParentId,
        owner: new mongoose.Types.ObjectId(userId),
        deleted: { $ne: true },
      });
      if (!targetDir) return { error: "대상 디렉토리를 찾을 수 없습니다." };
    }

    // 모든 디렉토리를 가져와서 순환 참조 체크에 사용
    const allDirs = await Directory.find({
      owner: new mongoose.Types.ObjectId(userId),
      deleted: { $ne: true },
    }).lean();

    const dirMap = new Map();
    allDirs.forEach((d) => dirMap.set(d._id.toString(), d));

    // 순환 참조 체크 헬퍼
    const wouldCreateCycle = (dirId, newParentId) => {
      if (!newParentId) return false;
      let current = newParentId;
      while (current) {
        if (current === dirId) return true;
        const parent = dirMap.get(current);
        current = parent?.parent?.toString() || null;
      }
      return false;
    };

    const results = { success: 0, failed: 0, errors: [] };

    for (const directoryId of directoryIds) {
      try {
        const dir = await Directory.findOne({
          _id: directoryId,
          owner: new mongoose.Types.ObjectId(userId),
          deleted: { $ne: true },
        });
        if (!dir) {
          results.failed++;
          results.errors.push(`디렉토리를 찾을 수 없음: ${directoryId}`);
          continue;
        }

        // 자기 자신으로 이동 불가
        if (targetParentId === directoryId) {
          results.failed++;
          results.errors.push(`자기 자신으로 이동 불가: ${dir.name}`);
          continue;
        }

        // 순환 참조 체크
        if (wouldCreateCycle(directoryId, targetParentId)) {
          results.failed++;
          results.errors.push(`순환 참조 오류: ${dir.name}`);
          continue;
        }

        dir.parent = targetParentId
          ? new mongoose.Types.ObjectId(targetParentId)
          : null;
        dir.updatedAt = new Date();
        await dir.save();
        results.success++;
      } catch (err) {
        results.failed++;
        results.errors.push(`오류: ${directoryId}`);
      }
    }

    return {
      success: true,
      message: `${results.success}개 디렉토리 이동 완료${results.failed > 0 ? `, ${results.failed}개 실패` : ""}`,
      results,
    };
  } catch (error) {
    console.error("벌크 디렉토리 이동 오류:", error);
    return { error: "디렉토리 이동 중 오류가 발생했습니다." };
  }
}

/**
 * 주어진 디렉토리의 모든 하위 디렉토리 ID 목록을 반환합니다 (재귀적).
 */
export async function getAllDescendantDirectoryIds(directoryId) {
  try {
    const userId = await requireAuthenticatedUser();
    if (!userId) {
      return { error: "로그인이 필요합니다." };
    }

    if (!directoryId) {
      return { ids: [] };
    }

    await connectToDatabase();

    const result = [];
    const queue = [directoryId];

    while (queue.length > 0) {
      const parentIds = queue.splice(0, queue.length);
      const children = await Directory.find({
        parent: { $in: parentIds },
        deleted: { $ne: true },
      }).select("_id").lean();

      for (const child of children) {
        const id = child._id.toString();
        result.push(id);
        queue.push(id);
      }
    }

    return { success: true, ids: result };
  } catch (error) {
    console.error("하위 디렉토리 조회 오류:", error);
    return { error: "하위 디렉토리를 조회하는 중 오류가 발생했습니다." };
  }
}
