"use server";

import { connectToDatabase } from "@/lib/db/mongodb";
import { verifyAccessToken } from "@/lib/auth/jwt";
import File from "@/models/File";
import Directory from "@/models/Directory";
import User from "@/models/User";
import mongoose from "mongoose";
import { cookies } from "next/headers";
import { checkActionRateLimit } from "@/lib/actionRateLimit";
import {
  generateUniqueFilename,
  generateFileHash,
  generateUploadUrl,
  generateDownloadUrl,
  deleteObject as deleteFileFromR2,
} from "@/lib/r2/r2Client";

async function getAuthenticatedUser() {
  const token = cookies().get("access_token")?.value;

  if (!token) {
    return null;
  }

  const decoded = await verifyAccessToken(token);
  if (!decoded) {
    return null;
  }

  return decoded.userId;
}

export async function getFileList({
  directoryId,
  page = 1,
  limit = 50,
  sortBy = "createdAt",
  sortOrder = "desc",
  shareLinkHash = "null",
}) {
  try {
    const userId = await getAuthenticatedUser();

    if (!userId) {
      return { error: "로그인이 필요합니다." };
    }

    await connectToDatabase();

    // 정렬 옵션
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === "asc" ? 1 : -1;

    // 디렉토리 필터링 및 권한 확인
    let hasDirectoryAccess = false;
    if (directoryId) {
      // 디렉토리 권한 확인
      const directory = await Directory.findOne({
        _id: directoryId,
        deleted: { $ne: true },
      });

      console.log("디렉토리 조회 결과:", directory);

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
          hasParentAccess = true;
          break; // 상위 디렉토리에 접근 권한이 있으면 중단
        }
        currentDirectory = parentDirectory; // 상위 디렉토리로 이동
      }
      console.log("디렉토리 소유자 여부:", isOwner);
      console.log("직접 공유 여부:", isDirectlyShared);
      console.log("상위 디렉토리 접근 권한 여부:", hasParentAccess);
      if (!isOwner && !isDirectlyShared && !hasParentAccess) {
        return { error: "디렉토리에 접근할 권한이 없습니다." };
      }

      hasDirectoryAccess = true;
    }

    // 필터 조건 (디렉토리 접근 권한이 있으면 해당 디렉토리의 모든 파일 조회)
    let filter;
    if (directoryId && hasDirectoryAccess) {
      // 디렉토리에 권한이 있으면 해당 디렉토리의 모든 파일에 접근 가능
      filter = {
        parentDirectory: new mongoose.Types.ObjectId(directoryId),
        deleted: { $ne: true },
      };
    } else if (directoryId) {
      // directoryId가 있지만 권한이 없는 경우 (위에서 이미 에러 반환)
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
        ],
        parentDirectory: new mongoose.Types.ObjectId(directoryId),
        deleted: { $ne: true },
      };
    } else {
      // 루트 디렉토리의 경우:
      // 1. 소유자이고 루트에 있는 파일들만
      // 2. 직접 공유받은 파일들 (루트에 있는 것들만)
      filter = {
        $or: [
          // 1. 소유한 파일 중 루트에 있는 것들
          {
            owner: new mongoose.Types.ObjectId(userId),
            parentDirectory: null,
          },
          // 2. 직접 공유받은 파일들 (루트에 있는 것들만)
          {
            "shared": {
              $elemMatch: {
                "userId": new mongoose.Types.ObjectId(userId),
              },
            },
            parentDirectory: null,
          },
        ],
        deleted: { $ne: true },
      };
    }

    // 파일 조회 (페이지네이션 적용, 공유자 정보 및 상위 디렉토리 정보 포함)
    const skip = (page - 1) * limit;
    const files = await File.find(filter)
      .populate({
        path: "owner",
        select: "name email",
      })
      .populate({
        path: "parentDirectory",
        select: "name owner",
        populate: {
          path: "owner",
          select: "name email",
        },
      })
      .populate({
        path: "shared.userId",
        select: "name email",
      })
      .sort(sortOptions)
      .skip(skip)
      .limit(limit)
      .lean();

    console.log(
      "조회된 파일들:",
      files.map((f) => ({
        id: f._id.toString(),
        originalName: f.originalName,
        isEncrypted: f.isEncrypted,
        originalSize: f.originalSize,
        originalMimetype: f.originalMimetype,
      })),
    );

    // 총 파일 수
    const totalFiles = await File.countDocuments(filter);
    const totalPages = Math.ceil(totalFiles / limit);

    return {
      files: files.map((file) => ({
        id: file._id.toString(),
        originalName: file.originalName,
        fileName: file.fileName,
        size: file.size,
        mimetype: file.mimetype,
        hash: file.hash,
        isPublic: file.isPublic,
        uploaded: file.uploaded,
        isEncrypted: file.isEncrypted || false,
        originalSize: file.originalSize,
        originalMimetype: file.originalMimetype,
        isWebGLBuild: file.isWebGLBuild || false,
        webGLValidated: file.webGLValidated || false,
        createdAt: file.createdAt ? file.createdAt.toISOString() : null,
        updatedAt: file.updatedAt ? file.updatedAt.toISOString() : null,
        parentDirectory: file.parentDirectory
          ? file.parentDirectory._id.toString()
          : null,
        parentDirectoryInfo: file.parentDirectory
          ? {
              id: file.parentDirectory._id.toString(),
              name: file.parentDirectory.name,
              owner: {
                id: file.parentDirectory.owner._id.toString(),
                name: file.parentDirectory.owner.name,
                email: file.parentDirectory.owner.email,
              },
            }
          : null,
        deleted: file.deleted,
        owner: file.owner._id.toString() === userId,
        ownerInfo: {
          id: file.owner._id.toString(),
          name: file.owner.name,
          email: file.owner.email,
        },
        sharedWith:
          file.shared?.map((share) => ({
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
        page,
        limit,
        totalFiles,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  } catch (error) {
    console.error("파일 목록 조회 오류:", error);
    return {
      error: "파일 목록을 조회하는 중 오류가 발생했습니다.",
    };
  }
}

export async function uploadFile({
  filename,
  size,
  mimetype,
  directoryId,
  isEncrypted = false,
  originalMetadata = null,
  shareHash = null,
  isWebGLBuild = false,
}) {
  try {
    // Rate limiting 체크
    const rateLimitResult = await checkActionRateLimit("upload");
    if (!rateLimitResult.allowed) {
      return {
        success: false,
        error: rateLimitResult.error,
      };
    }

    console.log("📥 서버에서 받은 매개변수:", {
      filename,
      size,
      mimetype,
      directoryId,
      isEncrypted,
      originalMetadata,
    });

    const userId = await getAuthenticatedUser();

    if (!userId) {
      return { error: "로그인이 필요합니다." };
    }

    if (!filename || !size || !mimetype) {
      return { error: "필수 파일 정보가 누락되었습니다." };
    }

    await connectToDatabase();

    // 사용자 조회 및 저장소 용량 확인
    const user = await User.findById(userId);
    if (!user) {
      return { error: "사용자를 찾을 수 없습니다." };
    }
    if (user.suspended) {
      return { error: "정지된 사용자입니다." };
    }
    // 이메일 인증 확인
    if (!user.isVerified) {
      return { error: "파일 업로드를 위해서는 이메일 인증이 필요합니다." };
    }

    // 저장소 용량 확인 (암호화된 경우 원본 크기 기준)
    const sizeToCheck =
      isEncrypted && originalMetadata ? originalMetadata.originalSize : size;
    if (user.storageUsed + sizeToCheck > user.storageLimit) {
      return { error: "저장소 용량이 부족합니다." };
    }

    // 디렉토리 검증 (directoryId가 있는 경우)
    if (directoryId) {
      let hasAccess = false;

      // 1. 일반 사용자 권한 확인 (소유자이거나 쓰기/관리자 권한으로 공유받은 경우)
      const directory = await Directory.findOne({
        _id: directoryId,
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

      if (directory) {
        hasAccess = true;
      }

      // 2. 링크 공유를 통한 접근인 경우 추가 확인
      if (!hasAccess && shareHash) {
        // 현재 디렉토리부터 상위 디렉토리까지 올라가면서 공유 링크 확인
        let currentDirId = directoryId;

        while (currentDirId && !hasAccess) {
          const sharedDirectory = await Directory.findOne({
            _id: currentDirId,
            "shareLinks.hash": shareHash,
            deleted: { $ne: true },
          }).lean();

          if (sharedDirectory) {
            const shareLink = sharedDirectory.shareLinks.find(
              (link) => link.hash === shareHash,
            );

            // 링크가 유효하고 업로드 권한이 있으며 만료되지 않은 경우
            if (
              shareLink &&
              shareLink.permission === "write" &&
              new Date() <= shareLink.expiresAt
            ) {
              hasAccess = true;
              break;
            }
          }

          // 상위 디렉토리로 이동
          const currentDir = await Directory.findById(currentDirId).lean();
          currentDirId = currentDir?.parent;
        }
      }

      // 3. 상위 디렉토리 접근 권한 확인
      let currentDirectory = await Directory.findById(directoryId).lean();
      while (currentDirectory && !hasAccess) {
        const parentDirectory = await Directory.findOne({
          _id: currentDirectory.parent,
          $or: [
            { owner: new mongoose.Types.ObjectId(userId) },
            {
              "shared": {
                $elemMatch: {
                  "userId": new mongoose.Types.ObjectId(userId),
                  "permission": { $in: ["write", "admin"] },
                },
              },
            },
          ],
          deleted: { $ne: true },
        });

        if (parentDirectory) {
          hasAccess = true;
        } else {
          currentDirectory = parentDirectory; // 상위 디렉토리로 이동
        }
      }
      // 최종 권한 확인
      console.log("디렉토리 접근 권한 여부:", hasAccess);
      // 권한이 없으면 에러 반환
      if (!hasAccess) {
        return { error: "디렉토리에 접근할 수 없습니다." };
      }
    }

    // 고유한 파일명 생성
    const uniqueFilename = generateUniqueFilename(filename);
    const fileHash = generateFileHash();

    // R2 업로드 URL 생성
    const uploadUrl = await generateUploadUrl(uniqueFilename, mimetype);

    // 파일 메타데이터 저장
    const fileData = {
      originalName:
        isEncrypted && originalMetadata
          ? originalMetadata.originalName
          : filename,
      fileName: uniqueFilename,
      size,
      mimetype,
      hash: fileHash,
      path: uniqueFilename, // R2에서 파일 경로는 fileName과 동일
      owner: userId,
      parentDirectory: directoryId
        ? new mongoose.Types.ObjectId(directoryId)
        : null,
      uploaded: false, // 업로드 완료 여부
      isEncrypted: isEncrypted || false,
      originalSize:
        isEncrypted && originalMetadata ? originalMetadata.originalSize : null,
      originalMimetype:
        isEncrypted && originalMetadata ? originalMetadata.originalType : null,
      isWebGLBuild: isWebGLBuild || false,
      webGLValidated: false,
    };

    // E2EE 메타데이터는 위에서 이미 설정됨

    console.log("파일 저장 데이터:", {
      originalName: fileData.originalName,
      fileName: fileData.fileName,
      isEncrypted: fileData.isEncrypted,
      originalSize: fileData.originalSize,
      originalMimetype: fileData.originalMimetype,
      size: fileData.size,
      mimetype: fileData.mimetype,
      isWebGLBuild: fileData.isWebGLBuild,
    });

    const file = new File(fileData);

    // E2EE 필드 명시적 설정 (Mongoose strict 모드 우회)
    if (isEncrypted) {
      file.isEncrypted = true;
      if (originalMetadata) {
        file.originalSize = originalMetadata.originalSize;
        file.originalMimetype = originalMetadata.originalType;
      }
    } else {
      file.isEncrypted = false;
      file.originalSize = null;
      file.originalMimetype = null;
    }

    await file.save();

    console.log("저장된 파일 데이터:", {
      id: file._id.toString(),
      isEncrypted: file.isEncrypted,
      originalSize: file.originalSize,
      originalMimetype: file.originalMimetype,
    });

    return {
      success: true,
      uploadUrl,
      fileId: file._id.toString(),
      hash: fileHash,
    };
  } catch (error) {
    console.error("파일 업로드 준비 오류:", error);
    return { error: "파일 업로드를 준비하는 중 오류가 발생했습니다." };
  }
}

export async function completeFileUpload({ fileId }) {
  try {
    const userId = await getAuthenticatedUser();

    if (!userId) {
      return { error: "로그인이 필요합니다." };
    }

    await connectToDatabase();

    const file = await File.findOne({
      _id: fileId,
      owner: userId,
      uploaded: false, // 업로드 완료되지 않은 파일
    });

    if (!file) {
      return { error: "파일을 찾을 수 없습니다." };
    }

    // 파일 상태를 완료로 변경
    file.uploaded = true;
    file.updatedAt = new Date();
    await file.save();

    // 사용자 저장소 사용량 업데이트 (암호화된 파일의 경우 원본 크기 사용)
    const sizeToIncrement =
      file.isEncrypted && file.originalSize ? file.originalSize : file.size;
    await User.findByIdAndUpdate(userId, {
      $inc: { storageUsed: sizeToIncrement },
    });

    return {
      success: true,
      message: "파일 업로드가 완료되었습니다.",
      file: {
        id: file._id.toString(),
        originalName: file.originalName,
        size: file.size,
        mimetype: file.mimetype,
        hash: file.hash,
      },
    };
  } catch (error) {
    console.error("파일 업로드 완료 오류:", error);
    return { error: "파일 업로드를 완료하는 중 오류가 발생했습니다." };
  }
}

export async function deleteFile({ fileId }) {
  try {
    const userId = await getAuthenticatedUser();

    if (!userId) {
      return { error: "로그인이 필요합니다." };
    }

    await connectToDatabase();

    // 파일 조회
    const file = await File.findOne({
      _id: fileId,
    });

    if (!file) {
      return { error: "파일을 찾을 수 없습니다." };
    }

    // 파일 삭제 권한 확인
    const isOwner = file.owner.toString() === userId;
    const hasDirectAdminAccess = file.shared?.some(
      (share) =>
        share.userId.toString() === userId && share.permission === "admin",
    );

    // 상위 디렉토리 권한 확인
    let hasParentAdminAccess = false;
    let currentDirectory = await Directory.findById(
      file.parentDirectory,
    ).lean();
    while (currentDirectory && !hasParentAdminAccess) {
      const parentDirectory = await Directory.findOne({
        _id: currentDirectory,
        $or: [
          { owner: new mongoose.Types.ObjectId(userId) },
          {
            "shared": {
              $elemMatch: {
                "userId": new mongoose.Types.ObjectId(userId),
                "permission": { $in: ["admin"] },
              },
            },
          },
        ],
        deleted: { $ne: true },
      });

      if (parentDirectory) {
        hasParentAdminAccess = true;
      } else {
        currentDirectory = currentDirectory.parent; // 상위 디렉토리로 이동
      }
    }

    // 삭제 권한 검증
    if (!isOwner && !hasDirectAdminAccess && !hasParentAdminAccess) {
      return { error: "파일을 삭제할 권한이 없습니다." };
    }

    // R2에서 파일 삭제
    try {
      await deleteFileFromR2(file.fileName);
    } catch (r2Error) {
      console.error("R2 파일 삭제 오류:", r2Error);
    }

    // 첨부된 미디어 파일들 캐스케이드 삭제
    const attachedMedia = await File.find({
      parentFile: file._id,
      deleted: { $ne: true },
    });

    let mediaSize = 0;
    for (const media of attachedMedia) {
      try {
        await deleteFileFromR2(media.fileName);
      } catch (r2Error) {
        console.error("미디어 R2 삭제 오류:", r2Error);
      }
      mediaSize += media.size || 0;
      media.deleted = true;
      media.deletedAt = new Date();
      await media.save();
    }

    // 데이터베이스에서 파일 삭제 (소프트 삭제)
    file.deleted = true;
    file.deletedAt = new Date();
    await file.save();

    // 소유자의 저장소 사용량 업데이트 (암호화된 파일의 경우 원본 크기 사용)
    if (file.owner.toString() === userId) {
      const sizeToDecrement =
        file.isEncrypted && file.originalSize ? file.originalSize : file.size;
      await User.findByIdAndUpdate(userId, {
        $inc: { storageUsed: -(sizeToDecrement + mediaSize) },
      });
    }

    return {
      success: true,
      message: "파일이 삭제되었습니다.",
    };
  } catch (error) {
    console.error("파일 삭제 오류:", error);
    return { error: "파일을 삭제하는 중 오류가 발생했습니다." };
  }
}

export async function getFileDownloadUrl({
  fileId,
  shareLinkHash = null,
  asPreview = false,
}) {
  try {
    const userId = await getAuthenticatedUser();

    if (!userId) {
      return { error: "로그인이 필요합니다." };
    }

    await connectToDatabase();

    // 파일 조회
    const file = await File.findOne({
      _id: fileId,
      deleted: { $ne: true },
    });

    if (!file) {
      return { error: "파일을 찾을 수 없습니다." };
    }

    // 파일 접근 권한 확인
    const isOwner = file.owner.toString() === userId;
    const isDirectlyShared = file.shared?.some(
      (share) => share.userId.toString() === userId,
    );
    // 현재 디렉토리 권한 확인
    let hasAccess = false;
    let currentDirectory = await Directory.findOne({
      _id: file.parentDirectory,
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
    }).lean();
    if (currentDirectory) {
      hasAccess = true;
    }
    // 상위 디렉토리로 올라가며 권한 확인
    let hasParentAccess = false;
    while (currentDirectory && !hasParentAccess) {
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

      if (parentDirectory) {
        hasParentAccess = true;
      } else {
        currentDirectory = parentDirectory; // 상위 디렉토리로 이동
      }
    }

    // 접근 권한 검증
    if (!isOwner && !isDirectlyShared && !hasParentAccess && !hasAccess) {
      return { error: "파일에 접근할 권한이 없습니다." };
    }

    console.log("파일 다운로드 정보:", {
      fileId: file._id.toString(),
      fileName: file.fileName,
      path: file.path,
      originalName: file.originalName,
      uploaded: file.uploaded,
      deleted: file.deleted,
    });

    // 파일이 업로드 완료되었는지 확인
    if (!file.uploaded) {
      return { error: "파일 업로드가 아직 완료되지 않았습니다." };
    }

    // R2에서 사용할 키 결정 (path 우선, 없으면 fileName 사용)
    const r2Key = file.path || file.fileName;

    // 다운로드 URL 생성 (원본 파일명과 함께)
    const downloadUrl = await generateDownloadUrl(
      r2Key,
      asPreview ? null : file.originalName,
    );

    return {
      success: true,
      downloadUrl,
      filename: file.originalName,
      size: file.size,
      mimetype: file.mimetype,
    };
  } catch (error) {
    console.error("파일 다운로드 URL 생성 오류:", error);
    return { error: "파일 다운로드 URL을 생성하는 중 오류가 발생했습니다." };
  }
}

export async function shareFile({ fileId, email, permission = "read" }) {
  try {
    // Rate limiting 체크
    const rateLimitResult = await checkActionRateLimit("share");
    if (!rateLimitResult.allowed) {
      return {
        success: false,
        error: rateLimitResult.error,
      };
    }

    const userId = await getAuthenticatedUser();

    if (!userId) {
      return { error: "로그인이 필요합니다." };
    }

    await connectToDatabase();

    // 파일 조회
    const file = await File.findOne({
      _id: fileId,
    });

    if (!file) {
      return { error: "파일을 찾을 수 없습니다." };
    }

    // 파일 공유 권한 확인
    const isOwner = file.owner.toString() === userId;
    const hasDirectAdminAccess = file.shared?.some(
      (share) =>
        share.userId.toString() === userId && share.permission === "admin",
    );

    // 상위 디렉토리 권한 확인
    let hasParentAdminAccess = false;
    let currentDirectory = await Directory.findById(
      file.parentDirectory,
    ).lean();
    while (currentDirectory && !hasParentAdminAccess) {
      const parentDirectory = await Directory.findOne({
        _id: currentDirectory,
        $or: [
          { owner: new mongoose.Types.ObjectId(userId) },
          {
            "shared": {
              $elemMatch: {
                "userId": new mongoose.Types.ObjectId(userId),
                "permission": { $in: ["admin"] },
              },
            },
          },
        ],
        deleted: { $ne: true },
      });

      if (parentDirectory) {
        hasParentAdminAccess = true;
      } else {
        currentDirectory = currentDirectory.parent; // 상위 디렉토리로 이동
      }
    }

    // 공유 권한 검증
    if (!isOwner && !hasDirectAdminAccess && !hasParentAdminAccess) {
      return { error: "파일을 공유할 권한이 없습니다." };
    }

    // 공유받을 사용자 조회
    const targetUser = await User.findOne({ email });
    if (!targetUser) {
      return { error: "해당 이메일의 사용자를 찾을 수 없습니다." };
    }

    // 소유자가 자신에게 공유하려고 시도하는지 확인
    if (file.owner.toString() === targetUser._id.toString()) {
      return { error: "파일 소유자는 본인에게 공유할 수 없습니다." };
    }

    // 이미 공유된 사용자인지 확인
    const existingShare = file.shared.find(
      (share) => share.userId.toString() === targetUser._id.toString(),
    );

    if (existingShare) {
      // 권한 업데이트
      existingShare.permission = permission;
    } else {
      // 새로운 공유 추가
      file.shared.push({
        userId: targetUser._id,
        permission,
      });
    }

    await file.save();

    return {
      success: true,
      message: "파일이 성공적으로 공유되었습니다.",
    };
  } catch (error) {
    console.error("파일 공유 오류:", error);
    return { error: "파일을 공유하는 중 오류가 발생했습니다." };
  }
}

export async function getFileDetails({ hash, fileId }) {
  try {
    const userId = await getAuthenticatedUser();

    if (!userId) {
      return { error: "로그인이 필요합니다." };
    }

    if (!hash && !fileId) {
      return { error: "파일 해시 또는 파일 ID가 필요합니다." };
    }

    await connectToDatabase();

    // 파일 조회 (hash 또는 fileId로)
    let query = {};
    if (hash) {
      query.hash = hash;
    } else if (fileId) {
      query._id = fileId;
    }

    const file = await File.findOne(query)
      .populate("owner", "name email")
      .populate({
        path: "shared.userId",
        select: "name email",
      });

    if (!file) {
      return { error: "파일을 찾을 수 없습니다." };
    }
    if (file.deleted) {
      return { error: "삭제된 파일입니다." };
    }

    // 접근 권한 확인
    const isOwner = file.owner._id.toString() === userId;
    const isShared = file.shared.some(
      (share) => share.userId._id.toString() === userId,
    );
    let permission = "none"; // 기본 권한은 없음
    // 최상위 디렉토리 권한 확인
    let hasParentAccess = false;
    while (file.parentDirectory && !hasParentAccess) {
      const parentDirectory = await Directory.findOne({
        _id: file.parentDirectory,
        deleted: { $ne: true },
      });
      if (!parentDirectory) {
        break; // 상위 디렉토리가 없으면 중단
      }
      // 상위 디렉토리 접근 권한 확인
      if (parentDirectory.owner._id.toString() === userId) {
        permission = "admin"; // 상위 디렉토리 소유자
        hasParentAccess = true;
        break; // 상위 디렉토리에 접근 권한이 있으면 중단
      }
      if (
        parentDirectory.shared.some(
          (share) => share.userId._id.toString() === userId,
        )
      ) {
        permission = "read"; // 상위 디렉토리에서 공유받은 경우
        hasParentAccess = true;
        break; // 상위 디렉토리에 접근 권한이 있으면 중단
      }
      // 상위 디렉토리로 이동
      file.parentDirectory = parentDirectory.parent; // 상위 디렉토리로 이동
    }

    if (!isOwner && !isShared && !file.isPublic && !hasParentAccess) {
      return { error: "해당 파일에 접근할 권한이 없습니다." };
    }

    // 권한 계산
    if (isOwner) {
      permission = "admin";
    } else if (isShared && permission === "none") {
      const userShare = file.shared.find(
        (share) => share.userId._id.toString() === userId,
      );
      permission = userShare ? userShare.permission : "read";
    }

    return {
      success: true,
      file: {
        id: file._id.toString(),
        originalName: file.originalName,
        fileName: file.fileName,
        size: file.size,
        mimetype: file.mimetype,
        hash: file.hash,
        isPublic: file.isPublic,
        uploaded: file.uploaded,
        isEncrypted: file.isEncrypted || false,
        originalSize: file.originalSize,
        originalMimetype: file.originalMimetype,
        isWebGLBuild: file.isWebGLBuild || false,
        webGLValidated: file.webGLValidated || false,
        createdAt: file.createdAt ? file.createdAt.toISOString() : null,
        updatedAt: file.updatedAt ? file.updatedAt.toISOString() : null,
        owner: {
          id: file.owner._id.toString(),
          name: file.owner.name,
          email: file.owner.email,
        },
        sharedWith: file.shared.map((share) => ({
          _id: share._id.toString(),
          userId: share.userId._id.toString(),
          user: {
            name: share.userId.name,
            email: share.userId.email,
          },
          permission: share.permission,
        })),
        userPermission: permission,
        canEdit: permission === "admin",
        canDelete: permission === "admin",
        canShare: permission === "admin",
      },
    };
  } catch (error) {
    console.error("파일 세부 정보 조회 오류:", error);
    return { error: "파일 정보를 조회하는 중 오류가 발생했습니다." };
  }
}

// 공유 링크로 파일 다운로드 URL 생성
export async function getSharedFileDownloadUrl({ fileId, shareHash }) {
  try {
    await connectToDatabase();

    // 공유 디렉토리 확인
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

    // 파일이 해당 디렉토리에 속하는지 확인
    const file = await File.findOne({
      _id: fileId,
      parentDirectory: directory._id,
      deleted: { $ne: true },
    });

    if (!file) {
      return {
        error: "파일을 찾을 수 없거나 해당 디렉토리에 속하지 않습니다.",
      };
    }

    // 파일이 업로드 완료되었는지 확인
    if (!file.uploaded) {
      return { error: "파일 업로드가 아직 완료되지 않았습니다." };
    }

    // R2에서 사용할 키 결정
    const r2Key = file.path || file.fileName;

    // 다운로드 URL 생성
    const downloadUrl = await generateDownloadUrl(r2Key, file.originalName);

    return {
      success: true,
      downloadUrl,
      filename: file.originalName,
      size: file.size,
      mimetype: file.mimetype,
      isEncrypted: file.isEncrypted || false,
      originalSize: file.originalSize,
      originalMimetype: file.originalMimetype,
    };
  } catch (error) {
    console.error("공유 파일 다운로드 URL 생성 오류:", error);
    return { error: "파일 다운로드 URL을 생성하는 중 오류가 발생했습니다." };
  }
}

// 사용자가 공유받은 디렉토리에 업로드한 파일들 조회
export async function getMyUploadedFiles({
  page = 1,
  limit = 20,
  sortBy = "createdAt",
  sortOrder = "desc",
}) {
  try {
    const userId = await getAuthenticatedUser();

    if (!userId) {
      return { error: "로그인이 필요합니다." };
    }

    await connectToDatabase();

    // 정렬 옵션
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === "asc" ? 1 : -1;

    // 사용자가 업로드한 파일들 조회
    const filter = {
      owner: new mongoose.Types.ObjectId(userId),
      deleted: { $ne: true },
    };

    // 파일 조회 (페이지네이션 적용, 상위 디렉토리 정보 포함)
    const skip = (page - 1) * limit;
    const files = await File.find(filter)
      .populate({
        path: "owner",
        select: "name email",
      })
      .populate({
        path: "parentDirectory",
        select: "name owner",
        populate: {
          path: "owner",
          select: "name email",
        },
      })
      .populate({
        path: "shared.userId",
        select: "name email",
      })
      .sort(sortOptions)
      .skip(skip)
      .limit(limit)
      .lean();

    // 총 파일 수
    const totalFiles = await File.countDocuments(filter);
    const totalPages = Math.ceil(totalFiles / limit);

    return {
      files: files.map((file) => ({
        id: file._id.toString(),
        originalName: file.originalName,
        fileName: file.fileName,
        size: file.size,
        mimetype: file.mimetype,
        hash: file.hash,
        isPublic: file.isPublic,
        uploaded: file.uploaded,
        isEncrypted: file.isEncrypted || false,
        originalSize: file.originalSize,
        originalMimetype: file.originalMimetype,
        isWebGLBuild: file.isWebGLBuild || false,
        webGLValidated: file.webGLValidated || false,
        createdAt: file.createdAt ? file.createdAt.toISOString() : null,
        updatedAt: file.updatedAt ? file.updatedAt.toISOString() : null,
        parentDirectory: file.parentDirectory?._id.toString(),
        parentDirectoryInfo: {
          id: file.parentDirectory?._id.toString(),
          name: file.parentDirectory?.name,
          owner: {
            id: file.parentDirectory?.owner._id.toString(),
            name: file.parentDirectory?.owner.name,
            email: file.parentDirectory?.owner.email,
          },
        },
        deleted: file.deleted,
        owner: true, // 항상 true (본인이 업로드한 파일이므로)
        ownerInfo: {
          id: file.owner._id.toString(),
          name: file.owner.name,
          email: file.owner.email,
        },
        sharedWith:
          file.shared?.map((share) => ({
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
        page,
        limit,
        totalFiles,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  } catch (error) {
    console.error("공유 디렉토리 업로드 파일 조회 오류:", error);
    return {
      error:
        "공유 디렉토리에 업로드한 파일 목록을 조회하는 중 오류가 발생했습니다.",
    };
  }
}

export async function removeFileShare({ fileId, shareId }) {
  try {
    const userId = await getAuthenticatedUser();

    if (!userId) {
      return { error: "로그인이 필요합니다." };
    }

    await connectToDatabase();

    // 파일 조회 및 권한 확인
    const file = await File.findById(fileId);

    if (!file) {
      return { error: "파일을 찾을 수 없습니다." };
    }

    // 파일 소유자이거나 관리자 권한이 있는지 확인
    const isOwner = file.owner.toString() === userId;
    const hasAdminPermission = file.shared.some(
      (share) =>
        share.userId.toString() === userId && share.permission === "admin",
    );

    // 상위 디렉토리 권한 확인
    let hasParentAdminAccess = false;
    let currentDirectory = await Directory.findById(
      file.parentDirectory,
    ).lean();
    while (currentDirectory && !hasParentAdminAccess) {
      const parentDirectory = await Directory.findOne({
        _id: currentDirectory,
        $or: [
          { owner: new mongoose.Types.ObjectId(userId) },
          {
            "shared": {
              $elemMatch: {
                "userId": new mongoose.Types.ObjectId(userId),
                "permission": { $in: ["admin"] },
              },
            },
          },
        ],
        deleted: { $ne: true },
      });

      if (parentDirectory) {
        hasParentAdminAccess = true;
      } else {
        currentDirectory = currentDirectory.parent; // 상위 디렉토리로 이동
      }
    }

    if (!isOwner && !hasAdminPermission && !hasParentAdminAccess) {
      return { error: "공유를 해제할 권한이 없습니다." };
    }

    // 공유 제거
    await File.findByIdAndUpdate(fileId, {
      $pull: { shared: { _id: shareId } },
    });

    return { message: "공유가 해제되었습니다." };
  } catch (error) {
    console.error("파일 공유 해제 오류:", error);
    return { error: "파일 공유 해제 중 오류가 발생했습니다." };
  }
}

// 디렉토리의 모든 파일을 재귀적으로 가져오는 함수
export async function getAllFilesForDownload({ directoryId }) {
  try {
    const userId = await getAuthenticatedUser();

    if (!userId) {
      return { error: "로그인이 필요합니다." };
    }

    await connectToDatabase();

    // 디렉토리 권한 확인
    if (directoryId) {
      const directory = await Directory.findOne({
        _id: directoryId,
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

      if (!directory) {
        return { error: "디렉토리에 접근할 권한이 없습니다." };
      }
    }

    // 재귀적으로 모든 파일과 하위 디렉토리를 가져오는 함수
    async function getFilesRecursively(parentId, path = "") {
      const files = [];

      // 현재 디렉토리의 파일들 가져오기
      const directFiles = await File.find({
        parentDirectory: parentId
          ? new mongoose.Types.ObjectId(parentId)
          : null,
        deleted: { $ne: true },
        uploaded: true, // 업로드 완료된 파일만
      }).lean();

      // 파일들을 결과에 추가
      for (const file of directFiles) {
        // 파일 접근 권한 확인
        const isOwner = file.owner.toString() === userId;
        const isDirectlyShared = file.shared?.some(
          (share) => share.userId.toString() === userId,
        );

        // 상위 디렉토리 권한 확인 (이미 디렉토리 권한을 확인했으므로 생략 가능)
        if (isOwner || isDirectlyShared || directoryId) {
          const r2Key = file.path || file.fileName;
          const downloadUrl = await generateDownloadUrl(
            r2Key,
            file.originalName,
          );

          files.push({
            id: file._id.toString(),
            originalName: file.originalName,
            fileName: file.fileName,
            size: file.size,
            mimetype: file.mimetype,
            downloadUrl,
            path: path ? `${path}/${file.originalName}` : file.originalName,
            isEncrypted: file.isEncrypted || false,
          });
        }
      }

      // 하위 디렉토리들 가져오기
      const subDirectories = await Directory.find({
        parent: parentId ? new mongoose.Types.ObjectId(parentId) : null,
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
      }).lean();

      // 각 하위 디렉토리에 대해 재귀 호출
      for (const subDir of subDirectories) {
        const subPath = path ? `${path}/${subDir.name}` : subDir.name;
        const subFiles = await getFilesRecursively(
          subDir._id.toString(),
          subPath,
        );
        files.push(...subFiles);
      }

      return files;
    }

    const allFiles = await getFilesRecursively(directoryId);

    return {
      success: true,
      files: allFiles,
    };
  } catch (error) {
    console.error("전체 파일 목록 조회 오류:", error);
    return { error: "파일 목록을 조회하는 중 오류가 발생했습니다." };
  }
}

// 선택된 파일들의 다운로드 정보를 가져오는 함수
export async function getSelectedFilesForDownload({ fileIds }) {
  try {
    const userId = await getAuthenticatedUser();

    if (!userId) {
      return { error: "로그인이 필요합니다." };
    }

    if (!fileIds || fileIds.length === 0) {
      return { error: "선택된 파일이 없습니다." };
    }

    await connectToDatabase();

    const files = [];

    for (const fileId of fileIds) {
      const file = await File.findOne({
        _id: fileId,
        deleted: { $ne: true },
        uploaded: true,
      });

      if (!file) {
        continue; // 파일이 없으면 건너뛰기
      }

      // 파일 접근 권한 확인
      const isOwner = file.owner.toString() === userId;
      const isDirectlyShared = file.shared?.some(
        (share) => share.userId.toString() === userId,
      );

      // 상위 디렉토리 권한 확인
      let hasParentAccess = false;
      if (file.parentDirectory) {
        const parentDirectory = await Directory.findOne({
          _id: file.parentDirectory,
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

        if (parentDirectory) {
          hasParentAccess = true;
        }
      }

      // 접근 권한이 있는 파일만 추가
      if (isOwner || isDirectlyShared || hasParentAccess) {
        const r2Key = file.path || file.fileName;
        const downloadUrl = await generateDownloadUrl(r2Key, file.originalName);

        files.push({
          id: file._id.toString(),
          originalName: file.originalName,
          fileName: file.fileName,
          size: file.size,
          mimetype: file.mimetype,
          downloadUrl,
          path: file.originalName, // 선택 다운로드는 플랫 구조
          isEncrypted: file.isEncrypted || false,
        });
      }
    }

    return {
      success: true,
      files,
    };
  } catch (error) {
    console.error("선택 파일 다운로드 정보 조회 오류:", error);
    return { error: "파일 정보를 조회하는 중 오류가 발생했습니다." };
  }
}

// 파일 내용 업데이트 준비 (에디터 저장용 - presigned URL 반환)
export async function prepareFileUpdate({ fileId }) {
  try {
    const userId = await getAuthenticatedUser();

    if (!userId) {
      return { error: "로그인이 필요합니다." };
    }

    if (!fileId) {
      return { error: "필수 매개변수가 누락되었습니다." };
    }

    await connectToDatabase();

    // 파일 조회
    const file = await File.findOne({
      _id: fileId,
      deleted: { $ne: true },
    });

    if (!file) {
      return { error: "파일을 찾을 수 없습니다." };
    }

    // 파일 소유자 또는 쓰기/관리 권한 확인
    const isOwner = file.owner.toString() === userId;
    const hasWriteAccess = file.shared?.some(
      (share) =>
        share.userId.toString() === userId &&
        ["write", "admin"].includes(share.permission),
    );

    // 상위 디렉토리 쓰기 권한 확인
    let hasParentWriteAccess = false;
    if (!isOwner && !hasWriteAccess) {
      let currentDirectory = await Directory.findById(
        file.parentDirectory,
      ).lean();
      while (currentDirectory && !hasParentWriteAccess) {
        const parentDir = await Directory.findOne({
          _id: currentDirectory._id,
          $or: [
            { owner: new mongoose.Types.ObjectId(userId) },
            {
              shared: {
                $elemMatch: {
                  userId: new mongoose.Types.ObjectId(userId),
                  permission: { $in: ["write", "admin"] },
                },
              },
            },
          ],
          deleted: { $ne: true },
        });

        if (parentDir) {
          hasParentWriteAccess = true;
        } else {
          currentDirectory = currentDirectory.parent
            ? await Directory.findById(currentDirectory.parent).lean()
            : null;
        }
      }
    }

    if (!isOwner && !hasWriteAccess && !hasParentWriteAccess) {
      return { error: "파일을 수정할 권한이 없습니다." };
    }

    // 기존 R2 키로 presigned PUT URL 생성
    const r2Key = file.path || file.fileName;
    const contentType = file.isEncrypted
      ? "application/octet-stream"
      : "application/json";
    const uploadUrl = await generateUploadUrl(r2Key, contentType);

    return {
      success: true,
      uploadUrl,
      fileId: file._id.toString(),
      currentSize: file.size,
      isEncrypted: file.isEncrypted || false,
      originalSize: file.originalSize || file.size,
    };
  } catch (error) {
    console.error("파일 업데이트 준비 오류:", error);
    return { error: "파일 업데이트를 준비하는 중 오류가 발생했습니다." };
  }
}

// 파일 내용 업데이트 완료 (클라이언트가 presigned URL로 업로드 후 호출)
export async function completeFileUpdate({ fileId, newSize, originalSize }) {
  try {
    const userId = await getAuthenticatedUser();

    if (!userId) {
      return { error: "로그인이 필요합니다." };
    }

    if (!fileId || newSize === undefined) {
      return { error: "필수 매개변수가 누락되었습니다." };
    }

    await connectToDatabase();

    const file = await File.findOne({
      _id: fileId,
      deleted: { $ne: true },
    });

    if (!file) {
      return { error: "파일을 찾을 수 없습니다." };
    }

    // 권한 재확인
    const isOwner = file.owner.toString() === userId;
    const hasWriteAccess = file.shared?.some(
      (share) =>
        share.userId.toString() === userId &&
        ["write", "admin"].includes(share.permission),
    );

    if (!isOwner && !hasWriteAccess) {
      return { error: "파일을 수정할 권한이 없습니다." };
    }

    // 파일 크기 업데이트
    const oldSize = file.size;
    file.size = newSize;
    if (originalSize !== undefined) {
      file.originalSize = originalSize;
    }
    file.updatedAt = new Date();
    await file.save();

    // 소유자 저장소 사용량 업데이트
    if (newSize !== oldSize) {
      await User.findByIdAndUpdate(file.owner, {
        $inc: { storageUsed: newSize - oldSize },
      });
    }

    return {
      success: true,
      message: "파일이 저장되었습니다.",
      size: newSize,
    };
  } catch (error) {
    console.error("파일 업데이트 완료 오류:", error);
    return { error: "파일 저장을 완료하는 중 오류가 발생했습니다." };
  }
}

// 파일 이름 변경
export async function renameFile({ fileId, newName }) {
  try {
    const userId = await getAuthenticatedUser();
    if (!userId) {
      return { error: "로그인이 필요합니다." };
    }

    if (!newName || !newName.trim()) {
      return { error: "파일 이름을 입력해주세요." };
    }

    const trimmedName = newName.trim();

    if (trimmedName.length > 255) {
      return { error: "파일 이름은 255자 이내로 입력해주세요." };
    }

    await connectToDatabase();

    const file = await File.findOne({
      _id: fileId,
      deleted: { $ne: true },
    });

    if (!file) {
      return { error: "파일을 찾을 수 없습니다." };
    }

    // 소유자만 이름 변경 가능
    if (file.owner.toString() !== userId) {
      return { error: "파일 이름을 변경할 권한이 없습니다." };
    }

    file.originalName = trimmedName;
    file.updatedAt = new Date();
    await file.save();

    return {
      success: true,
      message: "파일 이름이 변경되었습니다.",
      file: {
        id: file._id.toString(),
        originalName: file.originalName,
      },
    };
  } catch (error) {
    console.error("파일 이름 변경 오류:", error);
    return { error: "파일 이름을 변경하는 중 오류가 발생했습니다." };
  }
}

// 에디터 파일(.ejtxt) 목록 가져오기
export async function getEditorFiles() {
  try {
    const userId = await getAuthenticatedUser();
    if (!userId) {
      return { error: "로그인이 필요합니다." };
    }

    await connectToDatabase();

    // 내 파일들 (parentDirectory 포함)
    const ownFiles = await File.find({
      owner: new mongoose.Types.ObjectId(userId),
      originalName: { $regex: /\.ejtxt$/i },
      deleted: { $ne: true },
    })
      .populate("parentDirectory", "name")
      .sort({ updatedAt: -1 })
      .lean();

    // 직접 공유 받은 .ejtxt 파일들
    const directlySharedFiles = await File.find({
      "shared": {
        $elemMatch: {
          "userId": new mongoose.Types.ObjectId(userId),
        },
      },
      originalName: { $regex: /\.ejtxt$/i },
      deleted: { $ne: true },
    })
      .populate("owner", "name email")
      .populate("parentDirectory", "name")
      .sort({ updatedAt: -1 })
      .lean();

    // 디렉토리 공유를 통해 접근 가능한 .ejtxt 파일들
    // 사용자에게 공유된 디렉토리 찾기
    const sharedDirectories = await Directory.find({
      "shared": {
        $elemMatch: {
          "userId": new mongoose.Types.ObjectId(userId),
        },
      },
      deleted: { $ne: true },
    }).lean();

    // 공유된 디렉토리와 모든 하위 디렉토리의 ID 수집
    const sharedDirIds = new Set(sharedDirectories.map((d) => d._id.toString()));
    const sharedDirPermissions = {};
    sharedDirectories.forEach((d) => {
      const dirShare = d.shared?.find(
        (s) => (s.userId._id || s.userId).toString() === userId
      );
      sharedDirPermissions[d._id.toString()] = dirShare?.permission || "read";
    });

    if (sharedDirIds.size > 0) {
      // 하위 디렉토리를 재귀적으로 찾기
      let parentIds = [...sharedDirIds];
      while (parentIds.length > 0) {
        const childDirs = await Directory.find({
          parent: { $in: parentIds.map((id) => new mongoose.Types.ObjectId(id)) },
          deleted: { $ne: true },
        }).lean();

        const newParentIds = [];
        childDirs.forEach((d) => {
          const idStr = d._id.toString();
          if (!sharedDirIds.has(idStr)) {
            sharedDirIds.add(idStr);
            newParentIds.push(idStr);
            // 하위 디렉토리는 부모의 권한을 상속
            const parentId = d.parent.toString();
            sharedDirPermissions[idStr] = sharedDirPermissions[parentId] || "read";
          }
        });
        parentIds = newParentIds;
      }
    }

    // 공유 디렉토리 내의 .ejtxt 파일 조회 (소유한 파일과 직접 공유 파일 제외)
    const directlySharedFileIds = new Set(directlySharedFiles.map((f) => f._id.toString()));

    let dirSharedFiles = [];
    if (sharedDirIds.size > 0) {
      dirSharedFiles = await File.find({
        parentDirectory: { $in: [...sharedDirIds].map((id) => new mongoose.Types.ObjectId(id)) },
        originalName: { $regex: /\.ejtxt$/i },
        deleted: { $ne: true },
        owner: { $ne: new mongoose.Types.ObjectId(userId) },
      })
        .populate("owner", "name email")
        .populate("parentDirectory", "name")
        .sort({ updatedAt: -1 })
        .lean();

      // 이미 직접 공유된 파일은 제외
      dirSharedFiles = dirSharedFiles.filter(
        (f) => !directlySharedFileIds.has(f._id.toString())
      );
    }

    // 공유 파일 합치기
    const allSharedFiles = [...directlySharedFiles, ...dirSharedFiles];

    return {
      success: true,
      files: ownFiles.map((f) => ({
        id: f._id.toString(),
        originalName: f.originalName,
        size: f.size,
        hash: f.hash,
        isEncrypted: f.isEncrypted || false,
        isPublic: f.isPublic || false,
        createdAt: f.createdAt?.toISOString(),
        updatedAt: f.updatedAt?.toISOString(),
        parentDirectoryName: f.parentDirectory?.name || null,
      })),
      sharedFiles: allSharedFiles.map((f) => {
        const userShare = f.shared?.find(
          (s) => (s.userId._id || s.userId).toString() === userId
        );
        const dirPermission = f.parentDirectory
          ? sharedDirPermissions[f.parentDirectory._id?.toString() || f.parentDirectory.toString()]
          : null;
        return {
          id: f._id.toString(),
          originalName: f.originalName,
          size: f.size,
          hash: f.hash,
          isEncrypted: f.isEncrypted || false,
          isPublic: f.isPublic || false,
          createdAt: f.createdAt?.toISOString(),
          updatedAt: f.updatedAt?.toISOString(),
          parentDirectoryName: f.parentDirectory?.name || null,
          ownerName: f.owner?.name || f.owner?.email?.split("@")[0] || "알 수 없음",
          permission: userShare?.permission || dirPermission || "read",
        };
      }),
    };
  } catch (error) {
    console.error("에디터 파일 목록 오류:", error);
    return { error: "에디터 파일 목록을 불러오는 중 오류가 발생했습니다." };
  }
}

// 에디터 파일 단일 조회 (에디터 페이지용)
export async function getEditorFileById({ fileId }) {
  try {
    const userId = await getAuthenticatedUser();
    if (!userId) {
      return { error: "로그인이 필요합니다." };
    }

    await connectToDatabase();

    const file = await File.findOne({
      _id: fileId,
      deleted: { $ne: true },
    }).lean();

    if (!file) {
      return { error: "파일을 찾을 수 없습니다." };
    }

    // 소유자이거나 공유 받은 사용자인지 확인
    const isOwner = file.owner.toString() === userId;
    const sharedEntry = file.shared?.find(
      (s) => s.userId.toString() === userId
    );

    // 상위 디렉토리 공유 권한 확인
    let hasDirectoryAccess = false;
    let directoryPermission = null;
    if (!isOwner && !sharedEntry && file.parentDirectory) {
      let currentDirectory = await Directory.findOne({
        _id: file.parentDirectory,
        deleted: { $ne: true },
      }).lean();

      while (currentDirectory) {
        const isDirOwner = currentDirectory.owner.toString() === userId;
        const dirShare = currentDirectory.shared?.find(
          (s) => (s.userId._id || s.userId).toString() === userId
        );

        if (isDirOwner || dirShare) {
          hasDirectoryAccess = true;
          directoryPermission = isDirOwner ? "admin" : (dirShare?.permission || "read");
          break;
        }

        if (currentDirectory.parent) {
          currentDirectory = await Directory.findOne({
            _id: currentDirectory.parent,
            deleted: { $ne: true },
          }).lean();
        } else {
          break;
        }
      }
    }

    const hasAccess = isOwner || sharedEntry || hasDirectoryAccess;

    if (!hasAccess) {
      return { error: "파일에 접근할 권한이 없습니다." };
    }

    let permission = "read";
    if (isOwner) {
      permission = "admin";
    } else if (sharedEntry) {
      permission = sharedEntry.permission || "read";
    } else if (directoryPermission) {
      permission = directoryPermission;
    }

    return {
      success: true,
      file: {
        id: file._id.toString(),
        originalName: file.originalName,
        originalMimetype: file.originalMimetype,
        size: file.size,
        hash: file.hash,
        isEncrypted: file.isEncrypted || false,
        isPublic: file.isPublic || false,
        createdAt: file.createdAt?.toISOString(),
        updatedAt: file.updatedAt?.toISOString(),
        isOwner,
        permission,
      },
    };
  } catch (error) {
    console.error("에디터 파일 조회 오류:", error);
    return { error: "파일을 불러오는 중 오류가 발생했습니다." };
  }
}

// 새 에디터 파일(.ejtxt) 생성
export async function createEditorFile({
  filename,
  directoryId = null,
  isEncrypted = false,
  encryptionPassword = null,
}) {
  try {
    const userId = await getAuthenticatedUser();
    if (!userId) {
      return { error: "로그인이 필요합니다." };
    }

    if (!filename) {
      return { error: "파일 이름을 입력해주세요." };
    }

    // .ejtxt 확장자 보장
    const finalName = filename.endsWith(".ejtxt")
      ? filename
      : `${filename}.ejtxt`;

    await connectToDatabase();

    const user = await User.findById(userId);
    if (!user) return { error: "사용자를 찾을 수 없습니다." };
    if (user.suspended) return { error: "정지된 사용자입니다." };
    if (!user.isVerified) return { error: "이메일 인증이 필요합니다." };

    // 디렉토리 검증
    if (directoryId) {
      const dir = await Directory.findOne({
        _id: directoryId,
        owner: new mongoose.Types.ObjectId(userId),
        deleted: { $ne: true },
      });
      if (!dir) return { error: "디렉토리를 찾을 수 없습니다." };
    }

    // 빈 에디터 데이터 생성
    const emptyData = JSON.stringify({
      time: Date.now(),
      blocks: [{ type: "paragraph", data: { text: "" } }],
    });
    const dataBlob = Buffer.from(emptyData, "utf-8");
    const fileSize = dataBlob.length;

    // 저장소 용량 확인
    if (user.storageUsed + fileSize > user.storageLimit) {
      return { error: "저장소 용량이 부족합니다." };
    }

    const uniqueFilename = generateUniqueFilename(finalName);
    const fileHash = generateFileHash();
    const mimetype = isEncrypted
      ? "application/octet-stream"
      : "application/json";
    const uploadUrl = await generateUploadUrl(uniqueFilename, mimetype);

    const file = new File({
      originalName: finalName,
      fileName: uniqueFilename,
      size: fileSize,
      mimetype,
      hash: fileHash,
      path: uniqueFilename,
      owner: userId,
      parentDirectory: directoryId
        ? new mongoose.Types.ObjectId(directoryId)
        : null,
      uploaded: false,
      isEncrypted: isEncrypted || false,
      originalSize: isEncrypted ? fileSize : null,
      originalMimetype: isEncrypted ? "application/json" : null,
    });

    await file.save();

    return {
      success: true,
      file: {
        id: file._id.toString(),
        originalName: file.originalName,
        hash: file.hash,
        size: fileSize,
        isEncrypted: file.isEncrypted,
        createdAt: file.createdAt?.toISOString(),
        updatedAt: file.updatedAt?.toISOString(),
      },
      uploadUrl,
      initialData: emptyData,
    };
  } catch (error) {
    console.error("에디터 파일 생성 오류:", error);
    return { error: "파일 생성 중 오류가 발생했습니다." };
  }
}

// 새 에디터 파일 업로드 완료
export async function completeEditorFileCreation({ fileId }) {
  try {
    const userId = await getAuthenticatedUser();
    if (!userId) return { error: "로그인이 필요합니다." };

    await connectToDatabase();

    const file = await File.findOne({ _id: fileId, deleted: { $ne: true } });
    if (!file) return { error: "파일을 찾을 수 없습니다." };
    if (file.owner.toString() !== userId) return { error: "권한이 없습니다." };

    file.uploaded = true;
    await file.save();

    // 저장소 사용량 업데이트
    await User.findByIdAndUpdate(userId, {
      $inc: { storageUsed: file.size },
    });

    return { success: true };
  } catch (error) {
    console.error("에디터 파일 생성 완료 오류:", error);
    return { error: "파일 생성을 완료하는 중 오류가 발생했습니다." };
  }
}

// 파일 이동 (디렉토리 변경)
export async function moveFile({ fileId, targetDirectoryId }) {
  try {
    const userId = await getAuthenticatedUser();
    if (!userId) return { error: "로그인이 필요합니다." };

    await connectToDatabase();

    const file = await File.findOne({ _id: fileId, deleted: { $ne: true } });
    if (!file) return { error: "파일을 찾을 수 없습니다." };
    if (file.owner.toString() !== userId)
      return { error: "파일 이동 권한이 없습니다." };

    // 대상 디렉토리 검증 (null이면 루트로 이동)
    if (targetDirectoryId) {
      const targetDir = await Directory.findOne({
        _id: targetDirectoryId,
        owner: new mongoose.Types.ObjectId(userId),
        deleted: { $ne: true },
      });
      if (!targetDir) return { error: "대상 디렉토리를 찾을 수 없습니다." };
      file.parentDirectory = new mongoose.Types.ObjectId(targetDirectoryId);
    } else {
      file.parentDirectory = null;
    }

    file.updatedAt = new Date();
    await file.save();

    return { success: true, message: "파일이 이동되었습니다." };
  } catch (error) {
    console.error("파일 이동 오류:", error);
    return { error: "파일 이동 중 오류가 발생했습니다." };
  }
}

// 벌크 파일 이동
export async function bulkMoveFiles({ fileIds, targetDirectoryId }) {
  try {
    const userId = await getAuthenticatedUser();
    if (!userId) return { error: "로그인이 필요합니다." };
    if (!fileIds || fileIds.length === 0)
      return { error: "이동할 파일을 선택해주세요." };

    await connectToDatabase();

    // 대상 디렉토리 검증
    if (targetDirectoryId) {
      const targetDir = await Directory.findOne({
        _id: targetDirectoryId,
        owner: new mongoose.Types.ObjectId(userId),
        deleted: { $ne: true },
      });
      if (!targetDir) return { error: "대상 디렉토리를 찾을 수 없습니다." };
    }

    const results = { success: 0, failed: 0, errors: [] };

    for (const fileId of fileIds) {
      try {
        const file = await File.findOne({
          _id: fileId,
          deleted: { $ne: true },
        });
        if (!file) {
          results.failed++;
          results.errors.push(`파일을 찾을 수 없음: ${fileId}`);
          continue;
        }
        if (file.owner.toString() !== userId) {
          results.failed++;
          results.errors.push(`권한 없음: ${file.originalName}`);
          continue;
        }

        file.parentDirectory = targetDirectoryId
          ? new mongoose.Types.ObjectId(targetDirectoryId)
          : null;
        file.updatedAt = new Date();
        await file.save();
        results.success++;
      } catch (err) {
        results.failed++;
        results.errors.push(`오류: ${fileId}`);
      }
    }

    return {
      success: true,
      message: `${results.success}개 파일 이동 완료${results.failed > 0 ? `, ${results.failed}개 실패` : ""}`,
      results,
    };
  } catch (error) {
    console.error("벌크 파일 이동 오류:", error);
    return { error: "파일 이동 중 오류가 발생했습니다." };
  }
}

// 에디터 미디어 파일 업로드 (이미지 등)
export async function uploadEditorMedia({
  parentFileId,
  filename,
  size,
  mimetype,
}) {
  try {
    const userId = await getAuthenticatedUser();
    if (!userId) return { error: "로그인이 필요합니다." };

    if (!parentFileId || !filename || !size || !mimetype) {
      return { error: "필수 매개변수가 누락되었습니다." };
    }

    await connectToDatabase();

    // 부모 문서 파일 확인
    const parentFile = await File.findOne({
      _id: parentFileId,
      deleted: { $ne: true },
    });
    if (!parentFile) return { error: "문서를 찾을 수 없습니다." };

    // 소유자 또는 쓰기 권한 확인
    const isOwner = parentFile.owner.toString() === userId;
    const hasWriteAccess = parentFile.shared?.some(
      (s) =>
        s.userId.toString() === userId &&
        ["write", "admin"].includes(s.permission),
    );
    if (!isOwner && !hasWriteAccess)
      return { error: "파일 업로드 권한이 없습니다." };

    const user = await User.findById(userId);
    if (!user) return { error: "사용자를 찾을 수 없습니다." };
    if (user.suspended) return { error: "정지된 사용자입니다." };

    // 용량 확인
    if (user.storageUsed + size > user.storageLimit) {
      return { error: "저장소 용량이 부족합니다." };
    }

    // 미디어 크기 제한 (10MB)
    if (size > 10 * 1024 * 1024) {
      return { error: "미디어 파일은 10MB 이하만 업로드 가능합니다." };
    }

    const uniqueFilename = generateUniqueFilename(filename);
    const fileHash = generateFileHash();
    const uploadUrl = await generateUploadUrl(uniqueFilename, mimetype);

    const file = new File({
      originalName: filename,
      fileName: uniqueFilename,
      size,
      mimetype,
      hash: fileHash,
      path: uniqueFilename,
      owner: userId,
      parentDirectory: parentFile.parentDirectory || null,
      parentFile: new mongoose.Types.ObjectId(parentFileId),
      uploaded: false,
    });

    await file.save();

    return {
      success: true,
      file: {
        id: file._id.toString(),
        hash: file.hash,
        originalName: file.originalName,
      },
      uploadUrl,
    };
  } catch (error) {
    console.error("에디터 미디어 업로드 오류:", error);
    return { error: "미디어 업로드 중 오류가 발생했습니다." };
  }
}

// 에디터 미디어 업로드 완료
export async function completeEditorMediaUpload({ fileId }) {
  try {
    const userId = await getAuthenticatedUser();
    if (!userId) return { error: "로그인이 필요합니다." };

    await connectToDatabase();

    const file = await File.findOne({ _id: fileId, deleted: { $ne: true } });
    if (!file) return { error: "파일을 찾을 수 없습니다." };

    const isOwner = file.owner.toString() === userId;
    if (!isOwner) return { error: "권한이 없습니다." };

    file.uploaded = true;
    await file.save();

    // 스토리지 사용량 증가
    await User.findByIdAndUpdate(userId, {
      $inc: { storageUsed: file.size },
    });

    // 다운로드 URL 생성 (미디어 표시용)
    const downloadUrl = await generateDownloadUrl(file.path || file.fileName);

    return {
      success: true,
      url: downloadUrl,
      file: {
        id: file._id.toString(),
        hash: file.hash,
        originalName: file.originalName,
        size: file.size,
        mimetype: file.mimetype,
      },
    };
  } catch (error) {
    console.error("에디터 미디어 업로드 완료 오류:", error);
    return { error: "미디어 업로드 완료 처리 중 오류가 발생했습니다." };
  }
}

// 에디터 미디어 URL 가져오기 (에디터 로드 시 이미지 URL 갱신)
export async function getEditorMediaUrl({ fileHash }) {
  try {
    await connectToDatabase();

    const file = await File.findOne({ hash: fileHash, deleted: { $ne: true } });
    if (!file) return { error: "파일을 찾을 수 없습니다." };

    const downloadUrl = await generateDownloadUrl(file.path || file.fileName);
    return { success: true, url: downloadUrl };
  } catch (error) {
    console.error("에디터 미디어 URL 오류:", error);
    return { error: "미디어 URL을 가져오는 중 오류가 발생했습니다." };
  }
}

// 에디터 공유 링크 토글 (공개/비공개)
export async function toggleEditorShareLink({ fileId }) {
  try {
    const userId = await getAuthenticatedUser();
    if (!userId) return { error: "로그인이 필요합니다." };

    await connectToDatabase();

    const file = await File.findOne({ _id: fileId, deleted: { $ne: true } });
    if (!file) return { error: "파일을 찾을 수 없습니다." };
    if (file.owner.toString() !== userId) return { error: "권한이 없습니다." };

    file.isPublic = !file.isPublic;
    await file.save();

    return {
      success: true,
      isPublic: file.isPublic,
      shareUrl: file.isPublic
        ? `${process.env.NEXT_PUBLIC_APP_URL || ""}/share/${file.hash}`
        : null,
    };
  } catch (error) {
    console.error("에디터 공유 링크 토글 오류:", error);
    return { error: "공유 설정 변경 중 오류가 발생했습니다." };
  }
}
