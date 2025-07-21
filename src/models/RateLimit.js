import mongoose from "mongoose";

const rateLimitSchema = new mongoose.Schema(
  {
    identifier: {
      type: String,
      required: true,
      index: true,
    },
    actionName: {
      type: String,
      required: true,
      index: true,
    },
    count: {
      type: Number,
      default: 1,
    },
    resetTime: {
      type: Date,
      required: true,
      index: { expireAfterSeconds: 0 }, // MongoDB TTL로 자동 삭제
    },
    firstRequest: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// 복합 인덱스로 빠른 조회
rateLimitSchema.index({ identifier: 1, actionName: 1 }, { unique: true });

const RateLimit =
  mongoose.models.RateLimit || mongoose.model("RateLimit", rateLimitSchema);

export default RateLimit;
