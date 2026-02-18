import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from "crypto";

// 환경 변수에서 설정값 가져오기
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME;

if (
  !R2_ACCOUNT_ID ||
  !R2_ACCESS_KEY_ID ||
  !R2_SECRET_ACCESS_KEY ||
  !R2_BUCKET_NAME
) {
  throw new Error("Cloudflare R2 환경 변수가 설정되지 않았습니다.");
}

// R2 클라이언트 설정
const s3Client = new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

// 파일명을 고유하게 생성하는 함수
export function generateUniqueFilename(originalFilename) {
  const timestamp = Date.now();
  const randomString = crypto.randomBytes(8).toString("hex");
  const extension = originalFilename.split(".").pop();
  return `${timestamp}-${randomString}.${extension}`;
}

// 파일 해시 생성
export function generateFileHash() {
  return crypto.randomBytes(16).toString("hex");
}

// 업로드용 Presigned URL 생성
export async function generateUploadUrl(
  filePath,
  contentType,
  expiresIn = 3600,
  contentLength = null
) {
  if (!R2_BUCKET_NAME) {
    throw new Error("R2_BUCKET_NAME이 설정되지 않았습니다.");
  }

  try {
    const commandParams = {
      Bucket: R2_BUCKET_NAME,
      Key: filePath,
      ContentType: contentType,
    };

    // Content-Length 제한 설정으로 선언된 크기 이상의 파일 업로드 방지
    if (contentLength !== null && contentLength > 0) {
      commandParams.ContentLength = contentLength;
    }

    const command = new PutObjectCommand(commandParams);

    const presignedUrl = await getSignedUrl(s3Client, command, {
      expiresIn, // 1시간 동안 유효
    });

    return presignedUrl;
  } catch (error) {
    console.error("Presigned URL 생성 오류:", error);
    throw new Error("업로드 URL 생성 중 오류가 발생했습니다.");
  }
}

export async function uploadObject(
  key,
  body,
  contentType = "application/octet-stream"
) {
  if (!R2_BUCKET_NAME) {
    throw new Error("R2_BUCKET_NAME이 설정되지 않았습니다.");
  }

  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    Body: body,
    ContentType: contentType,
  });

  await s3Client.send(command);
}

// 다운로드용 Presigned URL 생성
export async function generateDownloadUrl(
  filePath,
  originalFilename = null,
  expiresIn = 3600
) {
  if (!R2_BUCKET_NAME) {
    throw new Error("R2_BUCKET_NAME이 설정되지 않았습니다.");
  }

  console.log("R2 다운로드 URL 생성 요청:", {
    bucket: R2_BUCKET_NAME,
    filePath: filePath,
    originalFilename: originalFilename,
    expiresIn: expiresIn,
  });

  try {
    const commandParams = {
      Bucket: R2_BUCKET_NAME,
      Key: filePath,
    };

    // 원본 파일명이 제공된 경우 Content-Disposition 헤더 추가
    if (originalFilename) {
      commandParams.ResponseContentDisposition = `attachment; filename="${encodeURIComponent(
        originalFilename
      )}"`;
    }

    const command = new GetObjectCommand(commandParams);

    const presignedUrl = await getSignedUrl(s3Client, command, {
      expiresIn,
    });

    console.log("R2 다운로드 URL 생성 성공:", presignedUrl);
    return presignedUrl;
  } catch (error) {
    console.error("다운로드 URL 생성 오류:", error);
    throw new Error("다운로드 URL 생성 중 오류가 발생했습니다.");
  }
}

// 객체 삭제
export async function deleteObject(key) {
  const command = new DeleteObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
  });

  return s3Client.send(command);
}

// 여러 파일을 한번에 삭제하는 함수
export async function deleteMultipleObjects(keys) {
  if (!keys || keys.length === 0) {
    return { success: true, deletedCount: 0 };
  }

  // S3/R2는 한 번에 최대 1000개의 객체만 삭제할 수 있음
  const batchSize = 1000;
  let deletedCount = 0;
  const errors = [];

  for (let i = 0; i < keys.length; i += batchSize) {
    const batch = keys.slice(i, i + batchSize);

    try {
      const command = new DeleteObjectsCommand({
        Bucket: R2_BUCKET_NAME,
        Delete: {
          Objects: batch.map((key) => ({ Key: key })),
          Quiet: false, // 삭제 결과를 반환받기 위해 false 설정
        },
      });

      const result = await s3Client.send(command);
      deletedCount += result.Deleted?.length || 0;

      // 삭제 실패한 파일들이 있다면 에러 정보 수집
      if (result.Errors && result.Errors.length > 0) {
        errors.push(...result.Errors);
      }
    } catch (error) {
      console.error(`배치 삭제 실패 (${i}-${i + batch.length}):`, error);
      errors.push({
        Key: `batch_${i}_${i + batch.length}`,
        Code: error.name,
        Message: error.message,
      });
    }
  }

  return {
    success: errors.length === 0,
    deletedCount,
    totalRequested: keys.length,
    errors,
  };
}
