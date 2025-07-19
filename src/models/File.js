import mongoose from "mongoose";

const FileSchema = new mongoose.Schema({
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

// 인덱스 설정
FileSchema.index({ hash: 1 });
FileSchema.index({ userId: 1 });
FileSchema.index({ parentDirectory: 1 });

const File = mongoose.models.File || mongoose.model("File", FileSchema);

export default File;
