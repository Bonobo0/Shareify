import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { twoFactor } from "better-auth/plugins/two-factor";
import { admin } from "better-auth/plugins/admin";
import { MongoClient } from "mongodb";

// MongoDB 클라이언트 싱글톤
let cachedClient = null;
let cachedDb = null;

async function getDatabase() {
  if (cachedDb) return cachedDb;
  
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI 환경 변수가 설정되지 않았습니다.");
  }
  
  if (!cachedClient) {
    cachedClient = new MongoClient(uri);
    await cachedClient.connect();
  }
  
  cachedDb = cachedClient.db();
  return cachedDb;
}

// Better Auth 설정 (lazy initialization)
let authInstance = null;

async function createAuth() {
  if (authInstance) return authInstance;
  
  const db = await getDatabase();
  
  authInstance = betterAuth({
    appName: "Shareify",
    
    // 데이터베이스 설정 - MongoDB 어댑터 사용
    database: mongodbAdapter(db),
    
    // 이메일/비밀번호 인증 활성화
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 6,
      sendResetPassword: async ({ user, url }) => {
        // 비밀번호 재설정 이메일 발송
        const { sendPasswordResetEmail } = await import("@/lib/email/emailService");
        await sendPasswordResetEmail({
          to: user.email,
          name: user.name || user.email,
          resetUrl: url,
        });
      },
    },
    
    // 세션 설정
    session: {
      expiresIn: 60 * 60 * 24 * 7, // 7일
      updateAge: 60 * 60 * 24, // 1일
      cookieCache: {
        enabled: true,
        maxAge: 60 * 5, // 5분
      },
    },
    
    // 소셜 로그인 프로바이더 - Keycloak
    socialProviders: {
      keycloak: {
        clientId: process.env.KEYCLOAK_CLIENT_ID || "",
        clientSecret: process.env.KEYCLOAK_CLIENT_SECRET || "",
        issuer: process.env.KEYCLOAK_ISSUER || "",
      },
    },
    
    // 이메일 인증 설정
    emailVerification: {
      sendOnSignUp: true,
      sendVerificationEmail: async ({ user, token }) => {
        const { sendVerificationEmail } = await import("@/lib/email/emailService");
        await sendVerificationEmail(user.email, token, user.name);
      },
    },
    
    // 사용자 설정
    user: {
      additionalFields: {
        storageLimit: {
          type: "number",
          defaultValue: 5368709120, // 5GB
        },
        storageUsed: {
          type: "number",
          defaultValue: 0,
        },
        profileImage: {
          type: "string",
          defaultValue: null,
        },
        role: {
          type: "string",
          defaultValue: "user",
        },
        suspended: {
          type: "boolean",
          defaultValue: false,
        },
        cliAccess: {
          type: "boolean",
          defaultValue: false,
        },
      },
    },
    
    // 플러그인
    plugins: [
      // 2FA 플러그인
      twoFactor({
        issuer: "Shareify",
        otpOptions: {
          period: 30,
          digits: 6,
        },
      }),
      // 관리자 플러그인
      admin(),
    ],
    
    // 고급 설정
    advanced: {
      useSecureCookies: process.env.NODE_ENV === "production",
    },
    
    // 신뢰할 수 있는 오리진
    trustedOrigins: [
      process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
    ],
  });
  
  return authInstance;
}

// Proxy를 사용하여 lazy initialization 지원
export const auth = new Proxy({}, {
  get: (target, prop) => {
    return async (...args) => {
      const instance = await createAuth();
      if (typeof instance[prop] === 'function') {
        return instance[prop](...args);
      }
      return instance[prop];
    };
  }
});

// 직접 auth 인스턴스가 필요한 경우 사용
export { createAuth as getAuth };
