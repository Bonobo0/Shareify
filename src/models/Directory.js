import mongoose from "mongoose";

const DirectorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    trim: true,
    default: "",
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  parent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Directory",
    default: null,
  },
  hash: {
    type: String,
    required: true,
    unique: true,
  },
  path: {
    type: String,
    required: true,
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
  shareLinks: [
    {
      hash: {
        type: String,
        required: true,
      },
      permission: {
        type: String,
        enum: ["read", "write"],
        default: "read",
      },
      expiresAt: {
        type: Date,
        required: true,
      },
      createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
      createdAt: {
        type: Date,
        default: Date.now,
      },
    },
  ],
  deleted: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// 인덱스 설정 - 성능 최적화
DirectorySchema.index({ owner: 1, deleted: 1 }); // 소유자별 디렉토리 조회 최적화
DirectorySchema.index({ parent: 1, deleted: 1 }); // 부모 디렉토리별 조회 최적화
DirectorySchema.index({ hash: 1 }); // 해시로 디렉토리 조회 최적화
DirectorySchema.index({ 'shared.userId': 1 }); // 공유된 디렉토리 조회 최적화
DirectorySchema.index({ 'shareLinks.hash': 1 }); // 공유 링크 조회 최적화

const Directory =
  mongoose.models.Directory || mongoose.model("Directory", DirectorySchema);

export default Directory;
