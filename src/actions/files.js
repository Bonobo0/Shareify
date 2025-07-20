"use server";

import { connectToDatabase } from "@/lib/db/mongodb";
import { verifyToken } from "@/lib/auth/jwt";
import File from "@/models/File";
import Directory from "@/models/Directory";
import User from "@/models/User";
import mongoose from "mongoose";
import { cookies } from "next/headers";
import {
  generateUniqueFilename,
  generateFileHash,
  generateUploadUrl,
  generateDownloadUrl,
  deleteObject as deleteFileFromR2,
} from "@/lib/r2/r2Client";

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
}) {
  try {
    const userId = await getAuthenticatedUser();

    if (!userId) {
      return { error: "인증이 필요합니다." };
    }

    await connectToDatabase();

    // 정렬 옵션
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === "asc" ? 1 : -1;

    // 필터 조건
    const filter = {
      $or: [
        { owner: new mongoose.Types.ObjectId(userId) },
        { "shared.userId": new mongoose.Types.ObjectId(userId) },
      ],
      deleted: { $ne: true },
    };

    // 디렉토리 필터링
    if (directoryId) {
      filter.parentDirectory = new mongoose.Types.ObjectId(directoryId);
    } else {
      filter.parentDirectory = null;
    }

    // 파일 조회 (페이지네이션 적용)
    const skip = (page - 1) * limit;
    const files = await File.find(filter)
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
      }))
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
        createdAt: file.createdAt ? file.createdAt.toISOString() : null,
        updatedAt: file.updatedAt ? file.updatedAt.toISOString() : null,
        parentDirectory: file.parentDirectory
          ? file.parentDirectory.toString()
          : null,
        deleted: file.deleted,
        owner: file.owner.toString() === userId,
        sharedWith:
          file.shared?.map((share) => ({
            userId: share.userId.toString(),
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
}) {
  try {
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
      return { error: "인증이 필요합니다." };
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
      return { error: "인증이 필요합니다." };
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
      return { error: "인증이 필요합니다." };
    }

    await connectToDatabase();

    const file = await File.findOne({
      _id: fileId,
      $or: [
        { owner: userId },
        {
          "shared.userId": userId,
          "shared.permission": { $in: ["write", "admin"] },
        },
      ],
    });

    if (!file) {
      return { error: "파일을 찾을 수 없거나 삭제 권한이 없습니다." };
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

export async function getFileDownloadUrl({ fileId }) {
  try {
    const userId = await getAuthenticatedUser();

    if (!userId) {
      return { error: "인증이 필요합니다." };
    }

    await connectToDatabase();

    const file = await File.findOne({
      _id: fileId,
      $or: [
        { owner: userId },
        {
          "shared.userId": userId,
          "shared.permission": { $in: ["read", "write", "admin"] },
        },
      ],
      deleted: { $ne: true },
    });

    if (!file) {
      return { error: "파일을 찾을 수 없거나 접근 권한이 없습니다." };
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
    const userId = await getAuthenticatedUser();

    if (!userId) {
      return { error: "인증이 필요합니다." };
    }

    await connectToDatabase();

    const file = await File.findOne({
      _id: fileId,
      $or: [
        { owner: userId },
        { "shared.userId": userId, "shared.permission": "admin" },
      ],
    });

    if (!file) {
      return { error: "파일을 찾을 수 없거나 공유 권한이 없습니다." };
    }

    // 공유받을 사용자 조회
    const targetUser = await User.findOne({ email });
    if (!targetUser) {
      return { error: "해당 이메일의 사용자를 찾을 수 없습니다." };
    }

    // 이미 공유된 사용자인지 확인
    const existingShare = file.shared.find(
      (share) => share.userId.toString() === targetUser._id.toString()
    );

    if (existingShare) {
      // 권한 업데이트
      existingShare.permission = permission;
    } else {
      // 새로운 공유 추가
      file.shared.push({
        userId: targetUser._id,
        permission,
        sharedAt: new Date(),
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

export async function getFileDetails({ hash }) {
  try {
    const userId = await getAuthenticatedUser();

    if (!userId) {
      return { error: "인증이 필요합니다." };
    }

    if (!hash) {
      return { error: "파일 해시가 필요합니다." };
    }

    await connectToDatabase();

    // 파일 조회
    const file = await File.findOne({ hash }).populate("owner", "name email");

    if (!file) {
      return { error: "파일을 찾을 수 없습니다." };
    }

    // 접근 권한 확인
    const isOwner = file.owner._id.toString() === userId;
    const isShared = file.shared.some(
      (share) => share.userId.toString() === userId
    );

    if (!isOwner && !isShared && !file.isPublic) {
      return { error: "해당 파일에 접근할 권한이 없습니다." };
    }

    // 권한 계산
    let permission = "read";
    if (isOwner) {
      permission = "admin";
    } else if (isShared) {
      const userShare = file.shared.find(
        (share) => share.userId.toString() === userId
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
        createdAt: file.createdAt ? file.createdAt.toISOString() : null,
        updatedAt: file.updatedAt ? file.updatedAt.toISOString() : null,
        owner: {
          id: file.owner._id.toString(),
          name: file.owner.name,
          email: file.owner.email,
        },
        sharedWith: file.shared.map((share) => ({
          userId: share.userId.toString(),
          permission: share.permission,
          sharedAt: share.sharedAt ? share.sharedAt.toISOString() : null,
        })),
        userPermission: permission,
        canEdit: permission === "write" || permission === "admin",
        canDelete: permission === "admin",
        canShare: permission === "admin",
      },
    };
  } catch (error) {
    console.error("파일 세부 정보 조회 오류:", error);
    return { error: "파일 정보를 조회하는 중 오류가 발생했습니다." };
  }
}
