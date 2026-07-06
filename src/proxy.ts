import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

const { auth } = NextAuth(authConfig);

// Next 16 "proxy" convention — same role as the old middleware.ts
export default auth;

export const config = {
  // protect everything except static assets and next internals
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)"],
};
