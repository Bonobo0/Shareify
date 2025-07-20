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

// 인덱스 설정
DirectorySchema.index({ userId: 1 });
DirectorySchema.index({ parent: 1 });

const Directory =
  mongoose.models.Directory || mongoose.model("Directory", DirectorySchema);

export default Directory;
