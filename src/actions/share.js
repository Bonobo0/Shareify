"use server";

import { connectToDatabase } from "@/lib/db/mongodb";
import { verifyToken } from "@/lib/auth/jwt";
import File from "@/models/File";
import Directory from "@/models/Directory";
import User from "@/models/User";
import mongoose from "mongoose";
import { generateDownloadUrl } from "@/lib/r2/r2Client";
import { cookies } from "next/headers";

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

export async function getSharedFileInfo({ hash }) {
  try {
    if (!hash) {
      return { error: "파일 해시가 필요합니다." };
    }

    await connectToDatabase();

    // 파일 조회
    const file = await File.findOne({ hash }).populate("owner", "name email");

    if (!file) {
      return { error: "파일을 찾을 수 없습니다." };
    }

    // 현재 사용자 확인
    const userId = await getAuthenticatedUser();

    // 접근 권한 확인
    let hasAccess = false;

    // 1. 공개 파일인 경우
    if (file.isPublic) {
      hasAccess = true;
    }

    // 2. 파일 소유자인 경우
    if (userId && file.owner._id.toString() === userId) {
      hasAccess = true;
    }

    // 3. 파일이 직접 공유된 경우
    if (
      userId &&
      file.shared &&
      file.shared.some((share) => share.userId.toString() === userId)
    ) {
      hasAccess = true;
    }

    // 4. 상위 디렉토리에 접근 권한이 있는 경우
    if (userId && file.parentDirectory) {
      const parentDirectory = await Directory.findById(file.parentDirectory);
      if (parentDirectory) {
        // 디렉토리 소유자인 경우
        if (parentDirectory.owner.toString() === userId) {
          hasAccess = true;
        }
        // 디렉토리가 공유된 경우
        if (
          parentDirectory.shared &&
          parentDirectory.shared.some(
            (share) => share.userId.toString() === userId
          )
        ) {
          hasAccess = true;
        }
      }
    }

    // 5. 상위 디렉토리에 활성화된 공유 링크가 있는 경우
    if (file.parentDirectory) {
      const parentDirectory = await Directory.findById(file.parentDirectory);
      if (
        parentDirectory &&
        parentDirectory.shareLinks &&
        parentDirectory.shareLinks.length > 0
      ) {
        // 만료되지 않은 공유 링크가 있는지 확인
        const activeShareLink = parentDirectory.shareLinks.find(
          (link) => new Date() <= link.expiresAt
        );
        if (activeShareLink) {
          hasAccess = true;
        }
      }
    }

    if (!hasAccess) {
      return { error: "이 파일에 접근할 권한이 없습니다." };
    }

    return {
      success: true,
      file: {
        id: file._id.toString(),
        originalName: file.originalName,
        mimetype: file.mimetype,
        size: file.size,
        hash: file.hash,
        createdAt: file.createdAt ? file.createdAt.toISOString() : null,
        ownerName:
          file.owner?.name || file.owner?.email.split("@")[0] || "알 수 없음",
        isEncrypted: file.isEncrypted,
        originalSize: file.originalSize,
        originalMimetype: file.originalMimetype,
      },
    };
  } catch (error) {
    console.error("공유 파일 정보 조회 에러:", error);
    return {
      error: "공유 파일 정보를 조회하는 중 오류가 발생했습니다.",
    };
  }
}

export async function downloadSharedFile({ hash }) {
  try {
    if (!hash) {
      return { error: "파일 해시가 필요합니다." };
    }

    await connectToDatabase();

    // 파일 조회
    const file = await File.findOne({ hash }).populate("owner", "name email");

    if (!file) {
      return { error: "파일을 찾을 수 없습니다." };
    }

    // 현재 사용자 확인
    const userId = await getAuthenticatedUser();

    // 접근 권한 확인
    let hasAccess = false;

    // 1. 공개 파일인 경우
    if (file.isPublic) {
      hasAccess = true;
    }

    // 2. 파일 소유자인 경우
    if (userId && file.owner._id.toString() === userId) {
      hasAccess = true;
    }

    // 3. 파일이 직접 공유된 경우
    if (
      userId &&
      file.shared &&
      file.shared.some((share) => share.userId.toString() === userId)
    ) {
      hasAccess = true;
    }

    // 4. 상위 디렉토리에 접근 권한이 있는 경우
    if (userId && file.parentDirectory) {
      const parentDirectory = await Directory.findById(file.parentDirectory);
      if (parentDirectory) {
        // 디렉토리 소유자인 경우
        if (parentDirectory.owner.toString() === userId) {
          hasAccess = true;
        }
        // 디렉토리가 공유된 경우
        if (
          parentDirectory.shared &&
          parentDirectory.shared.some(
            (share) => share.userId.toString() === userId
          )
        ) {
          hasAccess = true;
        }
      }
    }

    // 5. 상위 디렉토리에 활성화된 공유 링크가 있는 경우
    if (file.parentDirectory) {
      const parentDirectory = await Directory.findById(file.parentDirectory);
      if (
        parentDirectory &&
        parentDirectory.shareLinks &&
        parentDirectory.shareLinks.length > 0
      ) {
        // 만료되지 않은 공유 링크가 있는지 확인
        const activeShareLink = parentDirectory.shareLinks.find(
          (link) => new Date() <= link.expiresAt
        );
        if (activeShareLink) {
          hasAccess = true;
        }
      }
    }

    if (!hasAccess) {
      return { error: "이 파일을 다운로드할 권한이 없습니다." };
    }

    // R2에서 사용할 키 결정 (path 우선, 없으면 fileName 사용)
    const r2Key = file.path || file.fileName;

    // 다운로드 URL 생성 (원본 파일명과 함께)
    const downloadUrl = await generateDownloadUrl(r2Key, file.originalName);

    return {
      success: true,
      message: "다운로드 URL이 생성되었습니다.",
      downloadUrl,
      filename: file.originalName,
      isEncrypted: file.isEncrypted,
      originalSize: file.originalSize,
      originalMimetype: file.originalMimetype,
    };
  } catch (error) {
    console.error("공유 파일 다운로드 URL 생성 에러:", error);
    return {
      error: "다운로드 URL을 생성하는 중 오류가 발생했습니다.",
    };
  }
}

export async function getSharedItems() {
  try {
    const userId = await getAuthenticatedUser();

    if (!userId) {
      return { error: "인증이 필요합니다." };
    }

    await connectToDatabase();

    // 나와 공유된 파일들 조회
    const sharedFiles = await File.find({
      "shared": {
        $elemMatch: {
          "userId": new mongoose.Types.ObjectId(userId),
        },
      },
      deleted: { $ne: true },
    })
      .populate("owner", "name email")
      .sort({ "shared.sharedAt": -1 })
      .lean();

    // 나와 공유된 디렉토리들 조회
    const sharedDirectories = await Directory.find({
      "shared": {
        $elemMatch: {
          "userId": new mongoose.Types.ObjectId(userId),
        },
      },
      deleted: { $ne: true },
    })
      .populate("owner", "name email")
      .sort({ "shared.sharedAt": -1 })
      .lean();

    return {
      success: true,
      files: sharedFiles.map((file) => {
        const userShare = file.shared.find(
          (share) => share.userId.toString() === userId
        );
        return {
          id: file._id.toString(),
          originalName: file.originalName,
          mimetype: file.mimetype,
          size: file.size,
          hash: file.hash,
          createdAt: file.createdAt ? file.createdAt.toISOString() : null,
          updatedAt: file.updatedAt ? file.updatedAt.toISOString() : null,
          ownerName:
            file.owner?.name || file.owner?.email.split("@")[0] || "알 수 없음",
          permission: userShare?.permission || "read",
        };
      }),
      directories: sharedDirectories.map((dir) => {
        const userShare = dir.shared.find(
          (share) => share.userId.toString() === userId
        );
        return {
          id: dir._id.toString(),
          hash: dir.hash,
          name: dir.name,
          description: dir.description || "",
          createdAt: dir.createdAt ? dir.createdAt.toISOString() : null,
          updatedAt: dir.updatedAt ? dir.updatedAt.toISOString() : null,
          ownerName:
            dir.owner?.name || dir.owner?.email.split("@")[0] || "알 수 없음",
          permission: userShare?.permission || "read",
          sharedAt: userShare?.sharedAt
            ? userShare.sharedAt.toISOString()
            : null,
        };
      }),
    };
  } catch (error) {
    console.error("공유 아이템 조회 오류:", error);
    return {
      error: "공유된 아이템을 조회하는 중 오류가 발생했습니다.",
    };
  }
}

export async function toggleFilePublic({ fileId }) {
  try {
    const userId = await getAuthenticatedUser();

    if (!userId) {
      return { error: "인증이 필요합니다." };
    }

    await connectToDatabase();

    const file = await File.findOne({
      _id: fileId,
    });

    if (!file) {
      return { error: "파일을 찾을 수 없습니다." };
    }

    // 파일 공개 설정 권한 확인
    const isOwner = file.owner.toString() === userId;
    const hasDirectAdminAccess = file.shared?.some(
      (share) =>
        share.userId.toString() === userId && share.permission === "admin"
    );

    // 상위 디렉토리 권한 확인
    let hasParentAdminAccess = false;
    if (file.parentDirectory) {
      const parentDirectory = await Directory.findOne({
        _id: file.parentDirectory,
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

    // 공개 설정 권한 검증
    if (!isOwner && !hasDirectAdminAccess && !hasParentAdminAccess) {
      return { error: "파일 공개 설정을 변경할 권한이 없습니다." };
    }

    // 공개/비공개 상태 토글
    file.isPublic = !file.isPublic;
    await file.save();

    return {
      success: true,
      message: file.isPublic
        ? "파일이 공개되었습니다."
        : "파일이 비공개로 설정되었습니다.",
      isPublic: file.isPublic,
      shareUrl: file.isPublic ? `/share/${file.hash}` : null,
    };
  } catch (error) {
    console.error("파일 공개 상태 변경 오류:", error);
    return {
      error: "파일 공개 상태를 변경하는 중 오류가 발생했습니다.",
    };
  }
}

export async function removeShareAccess({
  fileId,
  directoryId,
  userId: targetUserId,
}) {
  try {
    const userId = await getAuthenticatedUser();

    if (!userId) {
      return { error: "인증이 필요합니다." };
    }

    await connectToDatabase();

    if (fileId) {
      // 파일 공유 해제
      const file = await File.findOne({
        _id: fileId,
      });

      if (!file) {
        return { error: "파일을 찾을 수 없습니다." };
      }

      // 파일 공유 해제 권한 확인
      const isOwner = file.owner.toString() === userId;
      const hasDirectAdminAccess = file.shared?.some(
        (share) =>
          share.userId.toString() === userId && share.permission === "admin"
      );

      // 상위 디렉토리 권한 확인
      let hasParentAdminAccess = false;
      if (file.parentDirectory) {
        const parentDirectory = await Directory.findOne({
          _id: file.parentDirectory,
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

      // 공유 해제 권한 검증
      if (!isOwner && !hasDirectAdminAccess && !hasParentAdminAccess) {
        return { error: "파일 공유를 해제할 권한이 없습니다." };
      }

      file.shared = file.shared.filter(
        (share) => share.userId.toString() !== targetUserId
      );
      await file.save();

      return {
        success: true,
        message: "파일 공유가 해제되었습니다.",
      };
    }

    if (directoryId) {
      // 디렉토리 공유 해제
      const directory = await Directory.findOne({
        _id: directoryId,
      });

      if (!directory) {
        return { error: "디렉토리를 찾을 수 없습니다." };
      }

      // 디렉토리 공유 해제 권한 확인
      const isOwner = directory.owner.toString() === userId;
      const hasDirectAdminAccess = directory.shared?.some(
        (share) =>
          share.userId.toString() === userId && share.permission === "admin"
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

      // 공유 해제 권한 검증
      if (!isOwner && !hasDirectAdminAccess && !hasParentAdminAccess) {
        return { error: "디렉토리 공유를 해제할 권한이 없습니다." };
      }

      directory.shared = directory.shared.filter(
        (share) => share.userId.toString() !== targetUserId
      );
      await directory.save();

      return {
        success: true,
        message: "디렉토리 공유가 해제되었습니다.",
      };
    }

    return { error: "파일 ID 또는 디렉토리 ID가 필요합니다." };
  } catch (error) {
    console.error("공유 해제 오류:", error);
    return {
      error: "공유를 해제하는 중 오류가 발생했습니다.",
    };
  }
}

// 공유 디렉토리 정보 조회 (링크 기반)
export async function getSharedDirectoryInfo({ shareHash }) {
  try {
    await connectToDatabase();

    const directory = await Directory.findOne({
      "shareLinks.hash": shareHash,
      deleted: { $ne: true },
    }).populate("owner", "name email");

    if (!directory) {
      return { error: "공유 링크를 찾을 수 없습니다." };
    }

    // 해당 공유 링크 찾기
    const shareLink = directory.shareLinks.find(
      (link) => link.hash === shareHash
    );

    if (!shareLink) {
      return { error: "유효하지 않은 공유 링크입니다." };
    }

    // 만료 시간 확인
    if (new Date() > shareLink.expiresAt) {
      return { error: "만료된 공유 링크입니다." };
    }

    // 디렉토리 내 파일 목록 조회
    const files = await File.find({
      parentDirectory: directory._id,
      deleted: { $ne: true },
    }).select(
      "originalName size createdAt hash mimetype originalMimetype originalSize isEncrypted"
    );

    // 하위 디렉토리 목록 조회
    const subdirectories = await Directory.find({
      parent: directory._id,
      deleted: { $ne: true },
    }).select("name createdAt hash");

    return {
      success: true,
      directory: {
        id: directory._id.toString(),
        name: directory.name,
        description: directory.description,
        owner: {
          name: directory.owner?.name,
          email: directory.owner?.email,
        },
        createdAt: directory.createdAt,
        hash: directory.hash,
      },
      files: files.map((file) => ({
        id: file._id.toString(),
        name: file.originalName,
        size: file.size,
        uploadedAt: file.createdAt,
        hash: file.hash,
        mimeType: file.mimetype,
        originalSize: file.originalSize,
        originalMimetype: file.originalMimetype,
        isEncrypted: file.isEncrypted || false,
      })),
      subdirectories: subdirectories.map((dir) => ({
        id: dir._id.toString(),
        name: dir.name,
        createdAt: dir.createdAt,
        hash: dir.hash,
      })),
      permission: shareLink.permission,
      expiresAt: shareLink.expiresAt,
    };
  } catch (error) {
    console.error("공유 디렉토리 정보 조회 오류:", error);
    return { error: "디렉토리 정보를 불러오는 중 오류가 발생했습니다." };
  }
}
