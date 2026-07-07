import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";
import { NextResponse } from "next/server";

// Simple in-memory rate limiter
const ipCache = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_LIMIT = 100; // max 100 requests per minute
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute

export default NextAuth(authConfig).auth((req) => {
  const ip = req.headers.get("x-forwarded-for") || (req as any).ip || "127.0.0.1";
  const now = Date.now();
  const cache = ipCache.get(ip) ?? { count: 0, resetAt: now + RATE_LIMIT_WINDOW };

  if (now > cache.resetAt) {
    cache.count = 0;
    cache.resetAt = now + RATE_LIMIT_WINDOW;
  }

  cache.count++;
  ipCache.set(ip, cache);

  if (cache.count > RATE_LIMIT_LIMIT) {
    return new NextResponse("Too many requests", { status: 429 });
  }

  return NextResponse.next();
});

export const config = {
  // protect everything except static assets and next internals
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)"],
};
