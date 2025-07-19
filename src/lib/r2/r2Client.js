import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
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
  expiresIn = 3600
) {
  if (!R2_BUCKET_NAME) {
    throw new Error("R2_BUCKET_NAME이 설정되지 않았습니다.");
  }

  try {
    const command = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: filePath,
      ContentType: contentType,
    });

    const presignedUrl = await getSignedUrl(s3Client, command, {
      expiresIn, // 1시간 동안 유효
    });

    return presignedUrl;
  } catch (error) {
    console.error("Presigned URL 생성 오류:", error);
    throw new Error("업로드 URL 생성 중 오류가 발생했습니다.");
  }
}

// 다운로드용 Presigned URL 생성
export async function generateDownloadUrl(filePath, expiresIn = 3600) {
  if (!R2_BUCKET_NAME) {
    throw new Error("R2_BUCKET_NAME이 설정되지 않았습니다.");
  }

  try {
    const command = new GetObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: filePath,
    });

    const presignedUrl = await getSignedUrl(s3Client, command, {
      expiresIn,
    });

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
