import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error("MongoDB URI가 환경 변수에 설정되어 있지 않습니다.");
}

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

export async function connectToDatabase() {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      // 연결 풀 최적화 옵션
      maxPoolSize: 10, // 최대 연결 수
      minPoolSize: 2,  // 최소 연결 수 유지
      maxIdleTimeMS: 30000, // 유휴 연결 유지 시간
      serverSelectionTimeoutMS: 5000, // 서버 선택 타임아웃
      socketTimeoutMS: 45000, // 소켓 타임아웃
    };

    cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongoose) => {
      console.log("MongoDB에 연결되었습니다!");
      return mongoose;
    });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}
