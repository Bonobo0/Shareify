import mongoose from "mongoose";

const FileSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    originalName: {
      type: String,
      required: true,
    },
    fileName: {
      type: String,
      required: true,
    },
    hash: {
      type: String,
      required: true,
      unique: true,
    },
    size: {
      type: Number,
      required: true,
    },
    mimetype: {
      type: String,
      required: true,
    },
    path: {
      type: String,
      required: true,
    },
    isPublic: {
      type: Boolean,
      default: false,
    },
    uploaded: {
      type: Boolean,
      default: false, // 업로드 완료 여부
    },
    // E2EE 관련 필드
    isEncrypted: {
      type: Boolean,
      default: false, // 파일이 암호화되었는지 여부
      required: false,
    },
    originalSize: {
      type: Number, // 암호화 전 원본 파일 크기
      required: false,
      default: null,
    },
    originalMimetype: {
      type: String, // 암호화 전 원본 MIME 타입
      required: false,
      default: null,
    },
    shared: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        permission: {
          type: String,
          enum: ["read", "write", "admin"],
          default: "read",
        },
      },
    ],
    parentDirectory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Directory",
      default: null,
    },
    // 에디터 미디어 첨부: 이 파일이 속한 문서 파일 ID
    parentFile: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "File",
      default: null,
    },
    deleted: {
      type: Boolean,
      default: false,
    },
    // WebGL 관련 필드
    isWebGLBuild: {
      type: Boolean,
      default: false, // WebGL 빌드 여부
      required: false,
    },
    webGLValidated: {
      type: Boolean,
      default: false, // WebGL 빌드 검증 완료 여부
      required: false,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    // 스키마 옵션
    strict: true, // 스키마에 정의된 필드만 허용
    versionKey: false, // __v 필드 제거
    timestamps: false, // createdAt, updatedAt을 수동 관리
  },
);

// 인덱스 설정 - 성능 최적화
FileSchema.index({ owner: 1, deleted: 1 }); // 소유자별 파일 조회 최적화
FileSchema.index({ parentDirectory: 1, deleted: 1 }); // 디렉토리별 파일 조회 최적화
FileSchema.index({ hash: 1 }); // 해시로 파일 조회 최적화
FileSchema.index({ createdAt: -1 }); // 최신순 정렬 최적화
FileSchema.index({ "shared.userId": 1 }); // 공유된 파일 조회 최적화

// 기존 모델이 있으면 재사용, 없으면 새로 생성
// 모델이 이미 존재하는 경우에는 기존 모델을 삭제하고 재생성
if (mongoose.models.File) {
  delete mongoose.models.File;
}

const File = mongoose.model("File", FileSchema);

export default File;
