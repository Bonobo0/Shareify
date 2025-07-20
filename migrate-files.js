/**
 * 기존 파일 데이터를 E2EE 필드와 함께 마이그레이션하는 스크립트
 * 기존 파일들은 모두 암호화되지 않은 파일로 처리
 */

import { connectToDatabase } from "./src/lib/db/mongodb.js";
import File from "./src/models/File.js";

async function migrateFileData() {
  try {
    await connectToDatabase();

    console.log("파일 데이터 마이그레이션 시작...");

    // isEncrypted 필드가 없는 파일들을 찾아서 업데이트
    const result = await File.updateMany(
      { isEncrypted: { $exists: false } },
      {
        $set: {
          isEncrypted: false,
          // originalSize와 originalMimetype이 없는 경우 기본값 설정
          originalSize: null,
          originalMimetype: null,
        },
      }
    );

    console.log(`${result.modifiedCount}개의 파일이 업데이트되었습니다.`);

    // 전체 파일 수 확인
    const totalFiles = await File.countDocuments();
    console.log(`총 파일 수: ${totalFiles}`);

    // 암호화된 파일 수 확인
    const encryptedFiles = await File.countDocuments({ isEncrypted: true });
    console.log(`암호화된 파일 수: ${encryptedFiles}`);

    // 일반 파일 수 확인
    const normalFiles = await File.countDocuments({ isEncrypted: false });
    console.log(`일반 파일 수: ${normalFiles}`);

    console.log("마이그레이션 완료!");
  } catch (error) {
    console.error("마이그레이션 중 오류 발생:", error);
  }
}

// 스크립트 실행
migrateFileData()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("스크립트 실행 오류:", error);
    process.exit(1);
  });
