"use client";

import JSZip from "jszip";
import { saveAs } from "file-saver";
import { decryptFile } from "@/lib/crypto/encryption";

// 단일 파일 다운로드 함수
export async function downloadFile(
  url,
  filename,
  isEncrypted = false,
  password = null
) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    let blob = await response.blob();

    // 암호화된 파일인 경우 복호화 처리
    if (isEncrypted && password) {
      try {
        const originalMetadata = {
          originalName: filename,
          originalType: blob.type || "application/octet-stream",
        };
        const decryptResult = await decryptFile(
          await blob.arrayBuffer(),
          password,
          originalMetadata
        );
        if (!decryptResult.success) {
          throw new Error(decryptResult.error);
        }
        blob = decryptResult.decryptedFile;
      } catch (decryptError) {
        throw new Error("파일 복호화에 실패했습니다. 비밀번호를 확인해주세요.");
      }
    }

    saveAs(blob, filename);
    return { success: true };
  } catch (error) {
    console.error("파일 다운로드 오류:", error);
    return { error: error.message || "파일 다운로드 중 오류가 발생했습니다." };
  }
}

// 여러 파일을 ZIP으로 압축하여 다운로드하는 함수
export async function downloadFilesAsZip(
  files,
  zipName = "download.zip",
  onProgress = null,
  encryptionPasswordMap = null // 파일별 비밀번호 맵 또는 단일 비밀번호 문자열
) {
  try {
    if (!files || files.length === 0) {
      throw new Error("다운로드할 파일이 없습니다.");
    }

    const zip = new JSZip();
    let completedFiles = 0;
    const totalFiles = files.length;
    const encryptedFiles = files.filter((file) => file.isEncrypted);

    // 암호화된 파일이 있는데 비밀번호가 없는 경우
    if (encryptedFiles.length > 0 && !encryptionPasswordMap) {
      throw new Error(
        "암호화된 파일이 포함되어 있습니다. 복호화 비밀번호가 필요합니다."
      );
    }

    // 진행률 콜백이 있으면 초기 상태 전달
    if (onProgress) {
      onProgress({
        completed: 0,
        total: totalFiles,
        currentFile: "",
        percentage: 0,
        encryptedCount: encryptedFiles.length,
      });
    }

    // 각 파일을 병렬로 다운로드하고 ZIP에 추가
    const downloadPromises = files.map(async (file) => {
      try {
        const response = await fetch(file.downloadUrl);
        if (!response.ok) {
          throw new Error(
            `Failed to download ${file.originalName}: ${response.status}`
          );
        }

        let blob = await response.blob();

        // 암호화된 파일인 경우 복호화 처리
        if (file.isEncrypted) {
          console.log(`암호화된 파일 처리 시작: ${file.originalName}`);
          console.log(`파일 정보:`, {
            id: file.id,
            originalName: file.originalName,
            originalMimetype: file.originalMimetype,
            mimetype: file.mimetype || file.mimeType,
            isEncrypted: file.isEncrypted,
          });

          let password = null;

          // 비밀번호 맵에서 해당 파일의 비밀번호 찾기
          if (
            typeof encryptionPasswordMap === "object" &&
            encryptionPasswordMap !== null
          ) {
            password = encryptionPasswordMap[file.id];
            console.log(
              `파일 ${file.id}의 비밀번호 찾기 결과:`,
              password ? "있음" : "없음"
            );
          } else if (typeof encryptionPasswordMap === "string") {
            password = encryptionPasswordMap;
            console.log(`단일 비밀번호 사용:`, password ? "있음" : "없음");
          }

          if (!password) {
            throw new Error(
              `${file.originalName}의 복호화 비밀번호가 제공되지 않았습니다.`
            );
          }

          try {
            console.log(`복호화 시작: ${file.originalName}`);
            const originalMetadata = {
              originalName: file.originalName || file.name,
              originalType:
                file.originalMimetype ||
                file.mimeType ||
                file.mimetype ||
                "application/octet-stream",
            };
            console.log(`복호화 메타데이터:`, originalMetadata);

            const decryptResult = await decryptFile(
              await blob.arrayBuffer(),
              password,
              originalMetadata
            );
            if (!decryptResult.success) {
              throw new Error(decryptResult.error);
            }
            blob = decryptResult.decryptedFile;
            console.log(`복호화 성공: ${file.originalName}`);
          } catch (decryptError) {
            console.error(`복호화 실패: ${file.originalName}`, decryptError);
            throw new Error(
              `${file.originalName} 복호화 실패: 비밀번호를 확인해주세요.`
            );
          }
        }

        // 폴더 구조를 유지하면서 파일을 ZIP에 추가
        // Blob을 ArrayBuffer로 변환하여 JSZip 호환성 확보
        let fileData;
        if (blob instanceof Blob) {
          fileData = await blob.arrayBuffer();
        } else if (blob instanceof ArrayBuffer) {
          fileData = blob;
        } else {
          // 다른 타입의 경우 Blob으로 변환 후 ArrayBuffer로 변환
          const newBlob = new Blob([blob]);
          fileData = await newBlob.arrayBuffer();
        }

        // 파일명은 originalName을 우선 사용, path는 폴더 구조가 있을 때만 사용
        const fileName = file.originalName || file.name || file.path;
        console.log(
          `ZIP에 추가할 파일명: ${fileName} (원본: ${file.originalName})`
        );

        zip.file(fileName, fileData);

        completedFiles++;

        // 진행률 업데이트
        if (onProgress) {
          onProgress({
            completed: completedFiles,
            total: totalFiles,
            currentFile: file.originalName,
            percentage: Math.round((completedFiles / totalFiles) * 100),
            encryptedCount: encryptedFiles.length,
          });
        }

        return { success: true, file: file.originalName };
      } catch (error) {
        console.error(`파일 ${file.originalName} 다운로드 실패:`, error);
        return { error: error.message, file: file.originalName };
      }
    });

    // 모든 파일 다운로드 완료까지 대기
    const results = await Promise.all(downloadPromises);

    // 실패한 파일들 확인
    const failedFiles = results.filter((result) => result.error);
    if (failedFiles.length > 0) {
      console.warn("일부 파일 다운로드 실패:", failedFiles);
    }

    // ZIP 파일 생성 및 다운로드
    if (onProgress) {
      onProgress({
        completed: totalFiles,
        total: totalFiles,
        currentFile: "ZIP 파일 생성 중...",
        percentage: 100,
      });
    }

    const zipBlob = await zip.generateAsync({
      type: "blob",
      compression: "DEFLATE",
      compressionOptions: {
        level: 6,
      },
    });

    saveAs(zipBlob, zipName);

    return {
      success: true,
      failedFiles: failedFiles.length > 0 ? failedFiles : null,
    };
  } catch (error) {
    console.error("ZIP 다운로드 오류:", error);
    return { error: error.message };
  }
}

// 파일 크기를 사람이 읽기 쉬운 형태로 변환
export function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

// 총 파일 크기 계산
export function calculateTotalSize(files) {
  return files.reduce((total, file) => total + (file.size || 0), 0);
}
