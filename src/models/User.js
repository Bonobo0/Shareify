import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const UserSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    index: true, // 이메일 조회 최적화
  },
  password: {
    type: String,
    required: true,
    select: false,
  },
  name: {
    type: String,
    trim: true,
  },
  profileImage: {
    type: String,
  },
  storageLimit: {
    type: Number,
    default: 5368709120, // 5GB
  },
  storageUsed: {
    type: Number,
    default: 0,
  },
  isVerified: {
    type: Boolean,
    default: false,
  },
  emailVerificationToken: {
    type: String,
    select: false,
  },
  emailVerificationExpires: {
    type: Date,
    select: false,
  },
  passwordResetToken: {
    type: String,
    select: false,
  },
  passwordResetExpires: {
    type: Date,
    select: false,
  },
  twoFactorEnabled: {
    type: Boolean,
    default: false,
  },
  twoFactorSecret: {
    type: String,
    select: false,
  },
  twoFactorBackupCodes: [
    {
      code: String,
      used: { type: Boolean, default: false },
    },
  ],
  role: {
    type: String,
    enum: ["user", "admin"],
    default: "user",
  },
  suspended: {
    type: Boolean,
    default: false,
  },
  cliAccess: {
    type: Boolean,
    default: false,
  },
  preferences: {
    itemsPerPage: {
      type: Number,
      default: 10,
      min: 5,
      max: 100,
    },
    editorViewMode: {
      type: String,
      enum: ["all", "directory"],
      default: "all",
    },
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

// 비밀번호 저장 전 해시화
UserSchema.pre("save", async function (next) {
  // 비밀번호가 변경된 경우에만 해시화
  if (!this.isModified("password")) return next();

  try {
    // bcrypt salt rounds: 10이 보안과 성능의 균형점
    // 12는 너무 느릴 수 있음 (특히 대량 사용자 생성 시)
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// 비밀번호 비교 메서드
UserSchema.methods.comparePassword = async function (candidatePassword) {
  try {
    // 입력값 검증
    if (!candidatePassword) {
      throw new Error("Password is required");
    }
    if (!this.password) {
      throw new Error("User password hash not found");
    }

    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    console.error("Password comparison error:", error);
    throw new Error(`Password comparison failed: ${error.message}`);
  }
};

// 사용자 정보 업데이트 전 타임스탬프 갱신
UserSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

// 모델이 이미 존재하는 경우에는 기존 모델을 삭제하고 재생성
if (mongoose.models.User) {
  delete mongoose.models.User;
}

const User = mongoose.model("User", UserSchema);

export default User;
