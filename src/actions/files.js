"use server";

import { connectToDatabase, getModel, isUsingMongoDB } from "@/lib/db/router";
import { verifyToken } from "@/lib/auth/jwt";
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

// Helper function to safely convert ID based on database type
async function toDBId(id) {
  if (!id) return id;
  const usingMongo = await isUsingMongoDB();
  if (usingMongo) {
    return await toDBId(id);
  }
  // For PostgreSQL, just return the string ID
  return id;
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
    const File = await getModel('File');
    const Directory = await getModel('Directory');

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
      const isOwner = (directory.owner._id || directory.owner.id || directory.owner).toString() === userId;
      const isDirectlyShared = directory.shared?.some((share) => {
        // Handle both populated and non-populated userId
        const shareUserId = share.userId._id
          ? (share.userId._id || share.userId.id || share.userId).toString()
          : (share.userId.id || share.userId).toString();
        return shareUserId === userId;
      });
      // 최상위 디렉토리 권한 확인
      let hasParentAccess = false;
      let currentDirectory = directory;
      // 상위 디렉토리로 올라가며 권한 확인
      while (currentDirectory && currentDirectory.parent) {
        const userIdForQuery = await toDBId(userId);
        const parentDirectory = await Directory.findOne({
          _id: currentDirectory.parent,
          $or: [
            { owner: userIdForQuery },
            {
              "shared": {
                $elemMatch: {
                  "userId": userIdForQuery,
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
          (parentDirectory.owner._id || parentDirectory.owner.id || parentDirectory.owner).toString() === userId ||
          parentDirectory.shared.some(
            (share) => (share.userId._id || share.userId.id || share.userId).toString() === userId
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
    const userIdForQuery = await toDBId(userId);
    const dirIdForQuery = directoryId ? await toDBId(directoryId) : null;
    
    let filter;
    if (directoryId && hasDirectoryAccess) {
      // 디렉토리에 권한이 있으면 해당 디렉토리의 모든 파일에 접근 가능
      filter = {
        parentDirectory: dirIdForQuery,
        deleted: { $ne: true },
      };
    } else if (directoryId) {
      // directoryId가 있지만 권한이 없는 경우 (위에서 이미 에러 반환)
      filter = {
        $or: [
          { owner: userIdForQuery },
          {
            "shared": {
              $elemMatch: {
                "userId": userIdForQuery,
              },
            },
          },
        ],
        parentDirectory: dirIdForQuery,
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
            owner: userIdForQuery,
            parentDirectory: null,
          },
          // 2. 직접 공유받은 파일들 (루트에 있는 것들만)
          {
            "shared": {
              $elemMatch: {
                "userId": userIdForQuery,
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
        id: (f._id || f.id).toString(),
        originalName: f.originalName,
        isEncrypted: f.isEncrypted,
        originalSize: f.originalSize,
        originalMimetype: f.originalMimetype,
      }))
    );

    // 총 파일 수
    const totalFiles = await File.countDocuments(filter);
    const totalPages = Math.ceil(totalFiles / limit);

    return {
      files: files.map((file) => ({
        id: (file._id || file.id).toString(),
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
        createdAt: file.createdAt ? (file.createdAt.toISOString ? file.createdAt.toISOString() : file.createdAt) : null,
        updatedAt: file.updatedAt ? (file.updatedAt.toISOString ? file.updatedAt.toISOString() : file.updatedAt) : null,
        parentDirectory: file.parentDirectory
          ? (file.parentDirectory._id || file.parentDirectory.id || file.parentDirectory).toString()
          : null,
        parentDirectoryInfo: file.parentDirectory
          ? {
              id: (file.parentDirectory._id || file.parentDirectory.id).toString(),
              name: file.parentDirectory.name,
              owner: {
                id: (file.parentDirectory.owner._id || file.parentDirectory.owner.id || file.parentDirectory.owner).toString(),
                name: file.parentDirectory.owner.name,
                email: file.parentDirectory.owner.email,
              },
            }
          : null,
        deleted: file.deleted,
        owner: (file.owner._id || file.owner.id || file.owner).toString() === userId,
        ownerInfo: {
          id: (file.owner._id || file.owner.id || file.owner).toString(),
          name: file.owner.name,
          email: file.owner.email,
        },
        sharedWith:
          file.shared?.map((share) => ({
            _id: (share._id || share.id).toString(),
            userId: (share.userId._id || share.userId.id || share.userId).toString(),
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
    const User = await getModel('User');
    const File = await getModel('File');
    const Directory = await getModel('Directory');
    const userIdForQuery = await toDBId(userId);
    const dirIdForQuery = directoryId ? await toDBId(directoryId) : null;

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
                "userId": userIdForQuery,
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
              (link) => link.hash === shareHash
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
            { owner: userIdForQuery },
            {
              "shared": {
                $elemMatch: {
                  "userId": userIdForQuery,
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
        ? dirIdForQuery
        : null,
      uploaded: false, // 업로드 완료 여부
      isEncrypted: isEncrypted || false,
      originalSize:
        isEncrypted && originalMetadata ? originalMetadata.originalSize : null,
      originalMimetype:
        isEncrypted && originalMetadata ? originalMetadata.originalType : null,
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
      id: (file._id || file.id).toString(),
      isEncrypted: file.isEncrypted,
      originalSize: file.originalSize,
      originalMimetype: file.originalMimetype,
    });

    return {
      success: true,
      uploadUrl,
      fileId: (file._id || file.id).toString(),
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
    const File = await getModel('File');
    const User = await getModel('User');

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
        id: (file._id || file.id).toString(),
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
    const File = await getModel('File');
    const User = await getModel('User');
    const Directory = await getModel('Directory');
    const userIdForQuery = await toDBId(userId);


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
        share.userId.toString() === userId && share.permission === "admin"
    );

    // 상위 디렉토리 권한 확인
    let hasParentAdminAccess = false;
    let currentDirectory = await Directory.findById(
      file.parentDirectory
    ).lean();
    while (currentDirectory && !hasParentAdminAccess) {
      const parentDirectory = await Directory.findOne({
        _id: currentDirectory,
        $or: [
          { owner: userIdForQuery },
          {
            "shared": {
              $elemMatch: {
                "userId": userIdForQuery,
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

    // 데이터베이스에서 파일 삭제 (소프트 삭제)
    file.deleted = true;
    file.deletedAt = new Date();
    await file.save();

    // 소유자의 저장소 사용량 업데이트 (암호화된 파일의 경우 원본 크기 사용)
    if (file.owner.toString() === userId) {
      const sizeToDecrement =
        file.isEncrypted && file.originalSize ? file.originalSize : file.size;
      await User.findByIdAndUpdate(userId, {
        $inc: { storageUsed: -sizeToDecrement },
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

export async function getFileDownloadUrl({ fileId, shareLinkHash = null }) {
  try {
    const userId = await getAuthenticatedUser();

    if (!userId) {
      return { error: "로그인이 필요합니다." };
    }

    await connectToDatabase();
    const File = await getModel('File');
    const Directory = await getModel('Directory');
    const userIdForQuery = await toDBId(userId);


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
      (share) => share.userId.toString() === userId
    );

    // 상위 디렉토리 권한 확인
    let hasParentAccess = false;
    let currentDirectory = await Directory.findById(
      file.parentDirectory
    ).lean();
    while (currentDirectory && !hasParentAccess) {
      const parentDirectory = await Directory.findOne({
        _id: currentDirectory.parent,
        $or: [
          { owner: userIdForQuery },
          {
            "shared": {
              $elemMatch: {
                "userId": userIdForQuery,
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
    if (!isOwner && !isDirectlyShared && !hasParentAccess) {
      return { error: "파일에 접근할 권한이 없습니다." };
    }

    // 접근 권한 검증
    if (!isOwner && !isDirectlyShared && !hasParentAccess) {
      return { error: "파일에 접근할 권한이 없습니다." };
    }

    console.log("파일 다운로드 정보:", {
      fileId: (file._id || file.id).toString(),
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
    const downloadUrl = await generateDownloadUrl(r2Key, file.originalName);

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
    const File = await getModel('File');
    const User = await getModel('User');
    const Directory = await getModel('Directory');
    const userIdForQuery = await toDBId(userId);


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
        share.userId.toString() === userId && share.permission === "admin"
    );

    // 상위 디렉토리 권한 확인
    let hasParentAdminAccess = false;
    let currentDirectory = await Directory.findById(
      file.parentDirectory
    ).lean();
    while (currentDirectory && !hasParentAdminAccess) {
      const parentDirectory = await Directory.findOne({
        _id: currentDirectory,
        $or: [
          { owner: userIdForQuery },
          {
            "shared": {
              $elemMatch: {
                "userId": userIdForQuery,
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
    if (file.owner.toString() === (targetUser._id || targetUser.id).toString()) {
      return { error: "파일 소유자는 본인에게 공유할 수 없습니다." };
    }

    // 이미 공유된 사용자인지 확인
    const existingShare = file.shared.find(
      (share) => share.userId.toString() === (targetUser._id || targetUser.id).toString()
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
    const File = await getModel('File');
    const Directory = await getModel('Directory');


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

    // 접근 권한 확인
    const isOwner = (file.owner._id || file.owner.id || file.owner).toString() === userId;
    const isShared = file.shared.some(
      (share) => (share.userId._id || share.userId.id || share.userId).toString() === userId
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
      if ((parentDirectory.owner._id || parentDirectory.owner.id || parentDirectory.owner).toString() === userId) {
        permission = "admin"; // 상위 디렉토리 소유자
        hasParentAccess = true;
        break; // 상위 디렉토리에 접근 권한이 있으면 중단
      }
      if (
        parentDirectory.shared.some(
          (share) => (share.userId._id || share.userId.id || share.userId).toString() === userId
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
        (share) => (share.userId._id || share.userId.id || share.userId).toString() === userId
      );
      permission = userShare ? userShare.permission : "read";
    }

    return {
      success: true,
      file: {
        id: (file._id || file.id).toString(),
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
        createdAt: file.createdAt ? file.createdAt.toISOString() : null,
        updatedAt: file.updatedAt ? file.updatedAt.toISOString() : null,
        owner: {
          id: (file.owner._id || file.owner.id || file.owner).toString(),
          name: file.owner.name,
          email: file.owner.email,
        },
        sharedWith: file.shared.map((share) => ({
          _id: (share._id || share.id).toString(),
          userId: (share.userId._id || share.userId.id || share.userId).toString(),
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
    const File = await getModel('File');
    const Directory = await getModel('Directory');


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
      (link) => link.hash === shareHash
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
    const File = await getModel('File');
    const Directory = await getModel('Directory');
    const userIdForQuery = await toDBId(userId);


    // 정렬 옵션
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === "asc" ? 1 : -1;

    // 사용자가 업로드한 파일들 조회
    const filter = {
      owner: userIdForQuery,
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
        id: (file._id || file.id).toString(),
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
        createdAt: file.createdAt ? file.createdAt.toISOString() : null,
        updatedAt: file.updatedAt ? file.updatedAt.toISOString() : null,
        parentDirectory: (file.parentDirectory?._id || file.parentDirectory?.id)?.toString(),
        parentDirectoryInfo: {
          id: (file.parentDirectory?._id || file.parentDirectory?.id)?.toString(),
          name: file.parentDirectory?.name,
          owner: {
            id: (file.parentDirectory?.owner._id || file.parentDirectory?.owner.id || file.parentDirectory?.owner)?.toString(),
            name: file.parentDirectory?.owner.name,
            email: file.parentDirectory?.owner.email,
          },
        },
        deleted: file.deleted,
        owner: true, // 항상 true (본인이 업로드한 파일이므로)
        ownerInfo: {
          id: (file.owner._id || file.owner.id || file.owner).toString(),
          name: file.owner.name,
          email: file.owner.email,
        },
        sharedWith:
          file.shared?.map((share) => ({
            _id: (share._id || share.id).toString(),
            userId: (share.userId._id || share.userId.id || share.userId).toString(),
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
    const File = await getModel('File');
    const Directory = await getModel('Directory');
    const userIdForQuery = await toDBId(userId);


    // 파일 조회 및 권한 확인
    const file = await File.findById(fileId);

    if (!file) {
      return { error: "파일을 찾을 수 없습니다." };
    }

    // 파일 소유자이거나 관리자 권한이 있는지 확인
    const isOwner = file.owner.toString() === userId;
    const hasAdminPermission = file.shared.some(
      (share) =>
        share.userId.toString() === userId && share.permission === "admin"
    );

    // 상위 디렉토리 권한 확인
    let hasParentAdminAccess = false;
    let currentDirectory = await Directory.findById(
      file.parentDirectory
    ).lean();
    while (currentDirectory && !hasParentAdminAccess) {
      const parentDirectory = await Directory.findOne({
        _id: currentDirectory,
        $or: [
          { owner: userIdForQuery },
          {
            "shared": {
              $elemMatch: {
                "userId": userIdForQuery,
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
    const File = await getModel('File');
    const Directory = await getModel('Directory');
    const userIdForQuery = await toDBId(userId);
    const parentIdForQuery = parentId ? await toDBId(parentId) : null;


    // 디렉토리 권한 확인
    if (directoryId) {
      const directory = await Directory.findOne({
        _id: directoryId,
        $or: [
          { owner: userIdForQuery },
          {
            "shared": {
              $elemMatch: {
                "userId": userIdForQuery,
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
          ? parentIdForQuery
          : null,
        deleted: { $ne: true },
        uploaded: true, // 업로드 완료된 파일만
      }).lean();

      // 파일들을 결과에 추가
      for (const file of directFiles) {
        // 파일 접근 권한 확인
        const isOwner = file.owner.toString() === userId;
        const isDirectlyShared = file.shared?.some(
          (share) => share.userId.toString() === userId
        );

        // 상위 디렉토리 권한 확인 (이미 디렉토리 권한을 확인했으므로 생략 가능)
        if (isOwner || isDirectlyShared || directoryId) {
          const r2Key = file.path || file.fileName;
          const downloadUrl = await generateDownloadUrl(
            r2Key,
            file.originalName
          );

          files.push({
            id: (file._id || file.id).toString(),
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
        parent: parentId ? parentIdForQuery : null,
        $or: [
          { owner: userIdForQuery },
          {
            "shared": {
              $elemMatch: {
                "userId": userIdForQuery,
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
          (subDir._id || subDir.id).toString(),
          subPath
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
    const File = await getModel('File');
    const userIdForQuery = await toDBId(userId);


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
        (share) => share.userId.toString() === userId
      );

      // 상위 디렉토리 권한 확인
      let hasParentAccess = false;
      if (file.parentDirectory) {
        const parentDirectory = await Directory.findOne({
          _id: file.parentDirectory,
          $or: [
            { owner: userIdForQuery },
            {
              "shared": {
                $elemMatch: {
                  "userId": userIdForQuery,
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
          id: (file._id || file.id).toString(),
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
