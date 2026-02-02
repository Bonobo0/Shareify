import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db/mongodb";
import { getApiSession } from "@/lib/auth-helpers";
import { checkActionRateLimit } from "@/lib/actionRateLimit";
import User from "@/models/User";
import File from "@/models/File";
import Directory from "@/models/Directory";
import {
  generateUniqueFilename,
  generateFileHash,
  generateUploadUrl,
} from "@/lib/r2/r2Client";

export const runtime = "nodejs";

function toObjectId(value) {
  if (!value) return null;
  if (value instanceof mongoose.Types.ObjectId) {
    return value;
  }
  return new mongoose.Types.ObjectId(value);
}

async function ensureDirectoryWriteAccess(
  userId,
  directoryId,
  shareHash = null
) {
  const directory = await Directory.findOne({
    hash: directoryId,
    deleted: { $ne: true },
  })
    .populate("owner", "_id")
    .populate("shared.userId", "_id");
  if (!directory) {
    return { allowed: false, error: "디렉토리를 찾을 수 없습니다." };
  }

  let hasAccess = false;

  if (directory.owner?._id?.toString() === userId) {
    hasAccess = true;
  }

  if (!hasAccess && Array.isArray(directory.shared)) {
    hasAccess = directory.shared.some((share) => {
      const sharedUserId = share.userId?._id
        ? share.userId._id.toString()
        : share.userId?.toString();
      return (
        sharedUserId === userId && ["write", "admin"].includes(share.permission)
      );
    });
  }

  if (!hasAccess && shareHash) {
    let currentDirId = directoryId;
    while (currentDirId && !hasAccess) {
      const sharedDirectory = await Directory.findOne({
        _id: currentDirId,
        "shareLinks.hash": shareHash,
        deleted: { $ne: true },
      })
        .select("shareLinks parent")
        .lean();

      if (sharedDirectory) {
        const shareLink = sharedDirectory.shareLinks.find(
          (link) => link.hash === shareHash
        );
        if (
          shareLink &&
          shareLink.permission === "write" &&
          new Date() <= new Date(shareLink.expiresAt)
        ) {
          hasAccess = true;
          break;
        }
      }

      const currentDir = await Directory.findById(currentDirId)
        .select("parent")
        .lean();
      if (!currentDir) {
        break;
      }
      currentDirId = currentDir.parent ? currentDir.parent.toString() : null;
    }
  }

  let current = directory;
  while (!hasAccess && current?.parent) {
    const parent = await Directory.findOne({
      _id: current.parent,
      deleted: { $ne: true },
    })
      .populate("owner", "_id")
      .populate("shared.userId", "_id");

    if (!parent) break;

    if (parent.owner?._id?.toString() === userId) {
      hasAccess = true;
      break;
    }

    if (Array.isArray(parent.shared)) {
      const parentAccess = parent.shared.some((share) => {
        const sharedUserId = share.userId?._id
          ? share.userId._id.toString()
          : share.userId?.toString();
        return (
          sharedUserId === userId &&
          ["write", "admin"].includes(share.permission)
        );
      });

      if (parentAccess) {
        hasAccess = true;
        break;
      }
    }

    current = parent;
  }

  if (!hasAccess) {
    return { allowed: false, error: "디렉토리에 접근할 수 없습니다." };
  }

  return { allowed: true, directory };
}

export async function POST(request) {
  try {
    const rateLimitResult = await checkActionRateLimit("upload");
    if (!rateLimitResult.allowed) {
      const response = NextResponse.json(
        { error: rateLimitResult.error },
        { status: 429 }
      );
      if (rateLimitResult.retryAfter) {
        response.headers.set("Retry-After", String(rateLimitResult.retryAfter));
      }
      return response;
    }

    // Better Auth 세션 검증
    const { user: sessionUser } = await getApiSession(request);

    if (!sessionUser?.id) {
      return NextResponse.json(
        { error: "인증 토큰이 필요합니다." },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { error: "요청 본문을 확인할 수 없습니다." },
        { status: 400 }
      );
    }

    const {
      filename,
      size,
      mimetype,
      directoryId = null,
      isEncrypted = false,
      originalMetadata = null,
      shareHash: shareHashRaw = null,
    } = body;

    if (!filename || typeof filename !== "string") {
      return NextResponse.json(
        { error: "파일 이름이 필요합니다." },
        { status: 400 }
      );
    }

    const sanitizedFilename = filename.trim();
    if (!sanitizedFilename) {
      return NextResponse.json(
        { error: "파일 이름이 필요합니다." },
        { status: 400 }
      );
    }

    const shareHash =
      typeof shareHashRaw === "string" && shareHashRaw.trim()
        ? shareHashRaw.trim()
        : null;

    const numericSize = Number(size);
    if (!Number.isFinite(numericSize) || numericSize <= 0) {
      return NextResponse.json(
        { error: "파일 크기가 올바르지 않습니다." },
        { status: 400 }
      );
    }

    const normalizedMime =
      typeof mimetype === "string" && mimetype.trim()
        ? mimetype.trim()
        : "application/octet-stream";

    const originalNameCandidate = (() => {
      if (isEncrypted && originalMetadata?.originalName) {
        const name = String(originalMetadata.originalName).trim();
        if (name) return name;
      }
      return sanitizedFilename;
    })();

    const originalSizeCandidate =
      isEncrypted && originalMetadata?.originalSize
        ? Number(originalMetadata.originalSize)
        : null;

    const originalMimeCandidate =
      isEncrypted && originalMetadata?.originalType
        ? String(originalMetadata.originalType)
        : null;

    if (
      isEncrypted &&
      originalMetadata?.originalSize &&
      !Number.isFinite(originalSizeCandidate)
    ) {
      return NextResponse.json(
        { error: "암호화된 파일의 원본 크기가 올바르지 않습니다." },
        { status: 400 }
      );
    }

    await connectToDatabase();

    const user = await User.findById(sessionUser.id);
    if (!user) {
      return NextResponse.json(
        { error: "사용자를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    if (user.suspended) {
      return NextResponse.json(
        { error: "정지된 사용자입니다." },
        { status: 403 }
      );
    }

    if (!user.cliAccess) {
      return NextResponse.json(
        { error: "CLI 업로드 권한이 없습니다." },
        { status: 403 }
      );
    }

    if (!user.isVerified) {
      return NextResponse.json(
        { error: "파일 업로드를 위해서는 이메일 인증이 필요합니다." },
        { status: 403 }
      );
    }

    const sizeToCheck =
      isEncrypted && originalSizeCandidate
        ? originalSizeCandidate
        : numericSize;

    if (user.storageUsed + sizeToCheck > user.storageLimit) {
      return NextResponse.json(
        { error: "저장소 용량이 부족합니다." },
        { status: 400 }
      );
    }

    let parentDirectory = null;
    if (directoryId) {
      const directoryResult = await ensureDirectoryWriteAccess(
        sessionUser.id,
        directoryId,
        shareHash
      );

      if (!directoryResult.allowed) {
        return NextResponse.json(
          { error: directoryResult.error },
          { status: 403 }
        );
      }

      parentDirectory = directoryResult.directory._id;
    }

    const uniqueFilename = generateUniqueFilename(sanitizedFilename);
    const fileHash = generateFileHash();
    const uploadUrl = await generateUploadUrl(uniqueFilename, normalizedMime);
    const parentDirectoryId = parentDirectory
      ? toObjectId(parentDirectory)
      : null;

    const fileDocument = new File({
      originalName: originalNameCandidate,
      fileName: uniqueFilename,
      size: numericSize,
      mimetype: normalizedMime,
      hash: fileHash,
      path: uniqueFilename,
      owner: sessionUser.id,
      parentDirectory: parentDirectoryId,
      uploaded: false,
      isEncrypted: Boolean(isEncrypted),
      originalSize:
        isEncrypted && originalSizeCandidate ? originalSizeCandidate : null,
      originalMimetype:
        isEncrypted && originalMimeCandidate ? originalMimeCandidate : null,
    });

    await fileDocument.save();

    return NextResponse.json({
      success: true,
      uploadUrl,
      file: {
        id: fileDocument._id.toString(),
        hash: fileDocument.hash,
        originalName: fileDocument.originalName,
        size: fileDocument.size,
        mimetype: fileDocument.mimetype,
        parentDirectory: fileDocument.parentDirectory
          ? fileDocument.parentDirectory.toString()
          : null,
        isEncrypted: fileDocument.isEncrypted,
        originalSize: fileDocument.originalSize,
        originalMimetype: fileDocument.originalMimetype,
      },
    });
  } catch (error) {
    console.error("CLI 파일 업로드 사전 작업 오류:", error);
    return NextResponse.json(
      { error: "업로드 URL 생성 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

export async function PATCH(request) {
  try {
    // Better Auth 세션 검증
    const { user: sessionUser } = await getApiSession(request);

    if (!sessionUser?.id) {
      return NextResponse.json(
        { error: "인증 토큰이 필요합니다." },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { error: "요청 본문을 확인할 수 없습니다." },
        { status: 400 }
      );
    }

    const { fileId } = body;

    if (!fileId || !mongoose.Types.ObjectId.isValid(fileId)) {
      return NextResponse.json(
        { error: "유효하지 않은 파일 ID입니다." },
        { status: 400 }
      );
    }

    await connectToDatabase();

    const user = await User.findById(sessionUser.id);
    if (!user) {
      return NextResponse.json(
        { error: "사용자를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    if (user.suspended) {
      return NextResponse.json(
        { error: "정지된 사용자입니다." },
        { status: 403 }
      );
    }

    if (!user.cliAccess) {
      return NextResponse.json(
        { error: "CLI 업로드 권한이 없습니다." },
        { status: 403 }
      );
    }

    const file = await File.findOne({
      _id: fileId,
      owner: sessionUser.id,
    });

    if (!file) {
      return NextResponse.json(
        { error: "파일을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    if (file.uploaded) {
      return NextResponse.json({
        success: true,
        message: "이미 업로드가 완료된 파일입니다.",
        file: {
          id: file._id.toString(),
          hash: file.hash,
          originalName: file.originalName,
          size: file.size,
          mimetype: file.mimetype,
          parentDirectory: file.parentDirectory
            ? file.parentDirectory.toString()
            : null,
          isEncrypted: file.isEncrypted,
          originalSize: file.originalSize,
          originalMimetype: file.originalMimetype,
        },
      });
    }

    file.uploaded = true;
    file.updatedAt = new Date();
    await file.save();

    const sizeToIncrement =
      file.isEncrypted && file.originalSize ? file.originalSize : file.size;

    await User.findByIdAndUpdate(file.owner, {
      $inc: { storageUsed: sizeToIncrement },
    }).exec();

    return NextResponse.json({
      success: true,
      message: "파일 업로드가 완료되었습니다.",
      file: {
        id: file._id.toString(),
        hash: file.hash,
        originalName: file.originalName,
        size: file.size,
        mimetype: file.mimetype,
        parentDirectory: file.parentDirectory
          ? file.parentDirectory.toString()
          : null,
        isEncrypted: file.isEncrypted,
        originalSize: file.originalSize,
        originalMimetype: file.originalMimetype,
      },
    });
  } catch (error) {
    console.error("CLI 파일 업로드 완료 처리 오류:", error);
    return NextResponse.json(
      { error: "파일 업로드 완료 처리 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
