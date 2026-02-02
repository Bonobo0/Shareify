import { createAuthClient } from "better-auth/react";
import { twoFactorClient } from "better-auth/client/plugins";
import { adminClient } from "better-auth/client/plugins";
import { genericOAuthClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  plugins: [
    twoFactorClient(),
    adminClient(),
    genericOAuthClient(),
  ],
});

// 편의를 위한 개별 메서드 export
export const {
  signIn,
  signUp,
  signOut,
  useSession,
  getSession,
  twoFactor,
} = authClient;
