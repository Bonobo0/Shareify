import { getAuth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

let handler = null;

async function getHandler() {
  if (!handler) {
    const auth = await getAuth();
    handler = toNextJsHandler(auth);
  }
  return handler;
}

export async function GET(request) {
  const { GET } = await getHandler();
  return GET(request);
}

export async function POST(request) {
  const { POST } = await getHandler();
  return POST(request);
}
