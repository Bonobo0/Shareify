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

    // 5. 상위 디렉토리 계층에서 활성화된 공유 링크가 있는 경우
    if (file.parentDirectory) {
      let currentDirId = file.parentDirectory;

      // 디렉토리 계층을 따라 올라가면서 공유 링크 확인
      while (currentDirId) {
        const directory = await Directory.findById(currentDirId);
        if (!directory) break;

        // 현재 디렉토리에 활성화된 공유 링크가 있는지 확인
        if (directory.shareLinks && directory.shareLinks.length > 0) {
          const activeShareLink = directory.shareLinks.find(
            (link) => new Date() <= link.expiresAt
          );
          if (activeShareLink) {
            hasAccess = true;
            break;
          }
        }

        // 상위 디렉토리로 이동
        currentDirId = directory.parent;
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

    // 5. 상위 디렉토리 계층에서 활성화된 공유 링크가 있는 경우
    if (file.parentDirectory) {
      let currentDirId = file.parentDirectory;

      // 디렉토리 계층을 따라 올라가면서 공유 링크 확인
      while (currentDirId) {
        const directory = await Directory.findById(currentDirId);
        if (!directory) break;

        // 현재 디렉토리에 활성화된 공유 링크가 있는지 확인
        if (directory.shareLinks && directory.shareLinks.length > 0) {
          const activeShareLink = directory.shareLinks.find(
            (link) => new Date() <= link.expiresAt
          );
          if (activeShareLink) {
            hasAccess = true;
            break;
          }
        }

        // 상위 디렉토리로 이동
        currentDirId = directory.parent;
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
export async function getSharedDirectoryInfo({ shareHash, subPath }) {
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

    // 현재 탐색할 디렉토리 결정
    let currentDirectory = directory;
    let breadcrumbPath = [
      { name: directory.name, path: "", description: directory.description },
    ];

    // subPath가 있는 경우 해당 경로의 디렉토리를 찾음
    if (subPath) {
      const pathParts = subPath.split("/").filter((p) => p);
      let currentParent = directory._id;
      let currentPath = "";

      for (const part of pathParts) {
        const subDir = await Directory.findOne({
          parent: currentParent,
          name: part,
          deleted: { $ne: true },
        });

        if (!subDir) {
          return { error: "요청한 경로를 찾을 수 없습니다." };
        }

        currentPath += (currentPath ? "/" : "") + part;
        breadcrumbPath.push({
          name: subDir.name,
          path: currentPath,
          description: subDir.description,
        });

        currentDirectory = subDir;
        currentParent = subDir._id;
      }
    }

    // 현재 디렉토리 내 파일 목록 조회
    const files = await File.find({
      parentDirectory: currentDirectory._id,
      deleted: { $ne: true },
    }).select(
      "originalName size createdAt hash mimetype originalMimetype originalSize isEncrypted"
    );

    // 현재 디렉토리의 하위 디렉토리 목록 조회
    const subdirectories = await Directory.find({
      parent: currentDirectory._id,
      deleted: { $ne: true },
    }).select("name createdAt hash");

    return {
      success: true,
      directory: {
        id: currentDirectory._id.toString(),
        name: currentDirectory.name,
        description: currentDirectory.description,
        owner: {
          name: directory.owner?.name, // 루트 디렉토리의 소유자 정보 사용
          email: directory.owner?.email,
        },
        createdAt: currentDirectory.createdAt,
        hash: currentDirectory.hash,
      },
      breadcrumbs: breadcrumbPath, // 브레드크럼 정보 추가
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

// 공유된 파일들을 선택 다운로드용으로 가져오기
export async function getSharedSelectedFilesForDownload({
  shareHash,
  fileIds,
}) {
  try {
    console.log("getSharedSelectedFilesForDownload 호출됨:", {
      shareHash,
      fileIds,
    });

    if (!shareHash || !fileIds || fileIds.length === 0) {
      return { error: "필수 정보가 누락되었습니다." };
    }

    await connectToDatabase();

    // 공유 디렉토리 정보 확인
    const sharedDirectory = await Directory.findOne({
      "shareLinks.hash": shareHash,
      deleted: { $ne: true },
    }).populate("shareLinks");

    if (!sharedDirectory) {
      return { error: "공유 링크를 찾을 수 없습니다." };
    }

    const shareLink = sharedDirectory.shareLinks.find(
      (link) => link.hash === shareHash
    );

    if (!shareLink || new Date() > shareLink.expiresAt) {
      return { error: "공유 링크가 만료되었거나 유효하지 않습니다." };
    }

    // 선택된 파일들을 직접 ID로 조회 (공유 디렉토리 계층 확인은 별도로)
    const files = await File.find({
      _id: { $in: fileIds.map((id) => new mongoose.Types.ObjectId(id)) },
      deleted: { $ne: true },
      uploaded: true,
    }).lean();

    console.log("조회된 파일들:", files.length, "개");

    if (files.length === 0) {
      return { error: "다운로드할 수 있는 파일이 없습니다." };
    }

    // 각 파일이 공유 디렉토리 하위에 있는지 확인
    const validFiles = [];
    for (const file of files) {
      // 파일의 상위 디렉토리 경로를 따라 올라가면서 공유 디렉토리 확인
      let currentDirId = file.parentDirectory;
      let isInSharedDirectory = false;

      while (currentDirId) {
        if (currentDirId.toString() === sharedDirectory._id.toString()) {
          isInSharedDirectory = true;
          break;
        }

        const parentDir = await Directory.findById(currentDirId);
        if (!parentDir) break;
        currentDirId = parentDir.parent;
      }

      if (isInSharedDirectory) {
        validFiles.push(file);
      }
    }

    console.log("유효한 파일들:", validFiles.length, "개");

    if (validFiles.length === 0) {
      return { error: "공유 디렉토리에 포함된 파일이 없습니다." };
    }

    // 파일 정보를 다운로드 모달 형식에 맞게 변환 (downloadUrl 포함)
    const fileList = [];
    for (const file of validFiles) {
      try {
        // 각 파일의 다운로드 URL 생성
        const downloadUrl = await generateDownloadUrl(
          file.path || file.fileName,
          file.originalName
        );

        const fileData = {
          id: file._id.toString(),
          originalName: file.originalName,
          size: file.size,
          mimetype: file.mimetype,
          mimeType: file.mimetype, // downloadFilesAsZip에서 사용하는 필드명
          originalMimetype: file.originalMimetype, // 암호화된 파일의 원본 MIME 타입
          originalSize: file.originalSize, // 암호화된 파일의 원본 크기
          isEncrypted: file.isEncrypted || false,
          fileName: file.fileName,
          path: file.originalName, // 선택 다운로드에서는 원본 파일명 사용
          downloadUrl: downloadUrl, // 다운로드 URL 추가
        };

        console.log(
          "파일 처리됨:",
          fileData.originalName,
          "암호화:",
          fileData.isEncrypted,
          "originalMimetype:",
          fileData.originalMimetype,
          "mimetype:",
          fileData.mimetype
        );
        fileList.push(fileData);
      } catch (urlError) {
        console.error(
          `Failed to generate download URL for ${file.originalName}:`,
          urlError
        );
        // URL 생성에 실패한 파일은 제외
        continue;
      }
    }

    if (fileList.length === 0) {
      return { error: "다운로드 URL을 생성할 수 있는 파일이 없습니다." };
    }

    console.log("최종 파일 목록:", fileList.length, "개");
    return {
      success: true,
      files: fileList,
    };
  } catch (error) {
    console.error("공유 파일 선택 다운로드 조회 오류:", error);
    return { error: "파일 정보를 가져오는 중 오류가 발생했습니다." };
  }
}

// 공유된 디렉토리의 모든 파일을 다운로드용으로 가져오기
export async function getSharedAllFilesForDownload({ shareHash, directoryId }) {
  try {
    console.log("getSharedAllFilesForDownload 호출됨:", {
      shareHash,
      directoryId,
    });

    if (!shareHash || !directoryId) {
      return { error: "필수 정보가 누락되었습니다." };
    }

    await connectToDatabase();

    // 먼저 공유 링크가 있는 루트 디렉토리를 찾기
    const rootSharedDirectory = await Directory.findOne({
      "shareLinks.hash": shareHash,
      deleted: { $ne: true },
    }).populate("shareLinks");

    console.log(
      "루트 공유 디렉토리 조회 결과:",
      rootSharedDirectory ? "찾음" : "못찾음"
    );

    if (!rootSharedDirectory) {
      return { error: "공유 링크를 찾을 수 없습니다." };
    }

    const shareLink = rootSharedDirectory.shareLinks.find(
      (link) => link.hash === shareHash
    );

    if (!shareLink || new Date() > shareLink.expiresAt) {
      return { error: "공유 링크가 만료되었거나 유효하지 않습니다." };
    }

    // 현재 디렉토리가 공유 디렉토리 하위에 있는지 확인
    const currentDirectory = await Directory.findById(directoryId);
    if (!currentDirectory) {
      return { error: "디렉토리를 찾을 수 없습니다." };
    }

    console.log("현재 디렉토리:", currentDirectory.name);

    // 현재 디렉토리가 공유 디렉토리 계층에 속하는지 확인
    let isInSharedHierarchy = false;
    let checkDirId = directoryId;

    while (checkDirId) {
      if (checkDirId.toString() === rootSharedDirectory._id.toString()) {
        isInSharedHierarchy = true;
        break;
      }

      const parentDir = await Directory.findById(checkDirId);
      if (!parentDir) break;
      checkDirId = parentDir.parent;
    }

    console.log("공유 계층에 속함:", isInSharedHierarchy);

    if (!isInSharedHierarchy) {
      return { error: "이 디렉토리는 공유된 계층에 속하지 않습니다." };
    }

    // 재귀적으로 모든 하위 파일들 조회 (현재 디렉토리부터 시작)
    const getAllFilesRecursively = async (dirId, basePath = "") => {
      const files = [];

      // 현재 디렉토리의 파일들
      const directFiles = await File.find({
        parentDirectory: dirId,
        deleted: { $ne: true },
        uploaded: true,
      }).lean();

      console.log(
        `디렉토리 ${basePath || "루트"}에서 ${directFiles.length}개 파일 발견`
      );

      for (const file of directFiles) {
        const relativePath = basePath
          ? `${basePath}/${file.originalName}`
          : file.originalName;

        try {
          // 각 파일의 다운로드 URL 생성
          const downloadUrl = await generateDownloadUrl(
            file.path || file.fileName,
            file.originalName
          );

          files.push({
            id: file._id.toString(),
            originalName: file.originalName,
            size: file.size,
            mimetype: file.mimetype,
            mimeType: file.mimetype, // downloadFilesAsZip에서 사용하는 필드명
            originalMimetype: file.originalMimetype, // 암호화된 파일의 원본 MIME 타입
            originalSize: file.originalSize, // 암호화된 파일의 원본 크기
            isEncrypted: file.isEncrypted || false,
            fileName: file.fileName,
            path: relativePath,
            downloadUrl: downloadUrl, // 다운로드 URL 추가
          });
        } catch (urlError) {
          console.error(
            `Failed to generate download URL for ${file.originalName}:`,
            urlError
          );
          // URL 생성에 실패한 파일은 제외
          continue;
        }
      }

      // 하위 디렉토리들
      const subdirectories = await Directory.find({
        parent: dirId,
        deleted: { $ne: true },
      }).lean();

      for (const subdir of subdirectories) {
        const subdirPath = basePath
          ? `${basePath}/${subdir.name}`
          : subdir.name;
        const subFiles = await getAllFilesRecursively(subdir._id, subdirPath);
        files.push(...subFiles);
      }

      return files;
    };

    const files = await getAllFilesRecursively(directoryId);

    console.log("전체 파일 수:", files.length);

    if (files.length === 0) {
      return { error: "다운로드할 파일이 없습니다." };
    }

    return {
      success: true,
      files: files,
    };
  } catch (error) {
    console.error("공유 디렉토리 전체 다운로드 조회 오류:", error);
    return { error: "파일 정보를 가져오는 중 오류가 발생했습니다." };
  }
}

// 공유 디렉토리의 개별 파일 다운로드
export async function downloadSharedDirectoryFile({ shareHash, fileId }) {
  try {
    if (!shareHash || !fileId) {
      return { error: "필수 매개변수가 누락되었습니다." };
    }

    await connectToDatabase();

    // 공유 디렉토리 정보 확인
    const sharedDirectory = await Directory.findOne({
      "shareLinks.hash": shareHash,
      "shareLinks.expiresAt": { $gte: new Date() },
    });

    if (!sharedDirectory) {
      return { error: "유효하지 않거나 만료된 공유 링크입니다." };
    }

    // 파일 조회
    const file = await File.findById(fileId).populate("owner", "name email");

    if (!file) {
      return { error: "파일을 찾을 수 없습니다." };
    }

    // 파일이 공유 디렉토리 내에 있는지 확인
    let hasAccess = false;
    let currentDirId = file.parentDirectory;

    while (currentDirId) {
      if (currentDirId.toString() === sharedDirectory._id.toString()) {
        hasAccess = true;
        break;
      }

      const parentDir = await Directory.findById(currentDirId);
      if (!parentDir) break;
      currentDirId = parentDir.parent;
    }

    if (!hasAccess) {
      return { error: "이 파일에 접근할 권한이 없습니다." };
    }

    // R2에서 사용할 키 결정 (path 우선, 없으면 fileName 사용)
    const r2Key = file.path || file.fileName;

    // 다운로드 URL 생성 (원본 파일명과 함께)
    const downloadUrl = await generateDownloadUrl(r2Key, file.originalName);

    return {
      success: true,
      downloadUrl,
      filename: file.originalName,
      mimeType: file.originalMimetype || file.mimeType,
      size: file.originalSize || file.size,
      isEncrypted: file.isEncrypted,
    };
  } catch (error) {
    console.error("공유 디렉토리 파일 다운로드 오류:", error);
    return { error: "파일 다운로드 중 오류가 발생했습니다." };
  }
}

// 공유 디렉토리 내에서 하위 디렉토리 생성
export async function createSharedSubdirectory({
  shareHash,
  name,
  description = "",
  subPath = "",
}) {
  try {
    if (!name || name.trim() === "") {
      return { error: "디렉토리 이름을 입력해주세요." };
    }

    await connectToDatabase();

    // 공유 디렉토리 정보 확인
    const sharedDirectory = await Directory.findOne({
      "shareLinks.hash": shareHash,
      deleted: { $ne: true },
    });

    if (!sharedDirectory) {
      return { error: "공유 링크를 찾을 수 없습니다." };
    }

    const shareLink = sharedDirectory.shareLinks.find(
      (link) => link.hash === shareHash
    );

    if (!shareLink || new Date() > shareLink.expiresAt) {
      return { error: "공유 링크가 만료되었거나 유효하지 않습니다." };
    }

    // 쓰기 권한 확인
    if (shareLink.permission !== "write") {
      return { error: "디렉토리 생성 권한이 없습니다." };
    }

    // 현재 위치의 부모 디렉토리 결정
    let parentDirectoryId = sharedDirectory._id;

    // subPath가 있는 경우 해당 경로의 디렉토리를 찾음
    if (subPath) {
      const pathParts = subPath.split("/").filter((p) => p);
      let currentParent = sharedDirectory._id;

      for (const part of pathParts) {
        const subDir = await Directory.findOne({
          parent: currentParent,
          name: part,
          deleted: { $ne: true },
        });

        if (!subDir) {
          return { error: "요청한 경로를 찾을 수 없습니다." };
        }

        currentParent = subDir._id;
      }
      
      parentDirectoryId = currentParent;
    }

    // 같은 위치에 같은 이름의 디렉토리가 있는지 확인
    const existingDirectory = await Directory.findOne({
      name: name.trim(),
      parent: parentDirectoryId,
      deleted: { $ne: true },
    });

    if (existingDirectory) {
      return { error: "같은 이름의 디렉토리가 이미 존재합니다." };
    }

    // 새 디렉토리 생성
    const crypto = await import("crypto");
    const directoryHash = crypto.randomBytes(16).toString("hex");
    const directoryPath = `/${name.trim()}`;

    const directory = new Directory({
      name: name.trim(),
      description: description?.trim() || "",
      owner: sharedDirectory.owner, // 원본 디렉토리 소유자와 동일
      parent: parentDirectoryId,
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
        createdAt: directory.createdAt.toISOString(),
      },
    };
  } catch (error) {
    console.error("공유 디렉토리 생성 오류:", error);
    return { error: "디렉토리를 생성하는 중 오류가 발생했습니다." };
  }
}
