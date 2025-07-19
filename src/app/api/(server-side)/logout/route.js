import { clearAuthCookie } from "@/lib/auth/jwt";

export async function POST() {
  return clearAuthCookie();
}
