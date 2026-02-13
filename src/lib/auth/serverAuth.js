import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { rotateRefreshToken, verifyAccessToken } from "@/lib/auth/jwt";

const ACCESS_TOKEN_MAX_AGE = 15 * 60; // 15 minutes
const REFRESH_TOKEN_MAX_AGE = 7 * 24 * 60 * 60; // 7 days

export async function getAuthenticatedUser({ allowRefresh = true } = {}) {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get("access_token")?.value;

    if (accessToken) {
      const decoded = await verifyAccessToken(accessToken);
      if (decoded?.userId) {
        return decoded.userId;
      }
    }

    if (!allowRefresh) {
      return null;
    }

    const refreshToken = cookieStore.get("refresh_token")?.value;
    if (!refreshToken) {
      return null;
    }

    const tokenPair = await rotateRefreshToken(refreshToken);
    if (!tokenPair) {
      return null;
    }

    cookieStore.set("access_token", tokenPair.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: ACCESS_TOKEN_MAX_AGE,
    });

    cookieStore.set("refresh_token", tokenPair.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: REFRESH_TOKEN_MAX_AGE,
    });

    const decoded = await verifyAccessToken(tokenPair.accessToken);
    return decoded?.userId || null;
  } catch (error) {
    console.error("Server auth refresh error:", error);
    return null;
  }
}

async function getCallbackPath() {
  try {
    const headerStore = await headers();
    const referer = headerStore.get("referer");
    if (!referer) return "/dashboard";
    const url = new URL(referer);
    return `${url.pathname}${url.search}` || "/dashboard";
  } catch (error) {
    return "/dashboard";
  }
}

export async function requireAuthenticatedUser(options = {}) {
  const userId = await getAuthenticatedUser(options);
  if (!userId) {
    const callbackUrl = encodeURIComponent(await getCallbackPath());
    redirect(`/user/signin?callbackUrl=${callbackUrl}`);
  }
  return userId;
}
