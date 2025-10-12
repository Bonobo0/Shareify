import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

export async function connectToDatabase() {
  // Only check for MONGODB_URI when actually connecting
  if (!MONGODB_URI) {
    throw new Error("MongoDB URI가 환경 변수에 설정되어 있지 않습니다.");
  }

  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
    };

    cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongoose) => {
      console.log("MongoDB에 연결되었습니다!");
      return mongoose;
    });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}
