import type { NextAuthConfig } from "next-auth";

export type Role = "platform_owner" | "firm_admin" | "associate" | "client";

const FIRM_PREFIXES = [
  "/dashboard",
  "/projects",
  "/library",
  "/templates",
  "/staff",
  "/clients",
  "/trash",
  "/settings",
];

/**
 * Edge-safe config shared with middleware. No node-only imports here
 * (no bcrypt, no db) — providers live in src/lib/auth.ts.
 */
export const authConfig = {
  secret: process.env.AUTH_SECRET ?? "dev-only-secret-change-me",
  pages: { signIn: "/login" },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 d ceiling (client sessions); staff enforced at 8 h below
  },
  providers: [],
  callbacks: {
    session({ session, token }) {
      if (token.userId) {
        session.user.id = token.userId as string;
        session.user.role = token.role as Role;
        session.user.firmId = (token.firmId as string | null) ?? null;
        session.user.clientId = (token.clientId as string | null) ?? null;
        session.user.name = (token.name as string) ?? session.user.name;
      }
      if (typeof token.staffExpiresAt === "number") {
        session.staffExpiresAt = token.staffExpiresAt;
      }
      return session;
    },
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const user = auth?.user;

      // staff sessions are capped at 8 h even though the cookie lives longer
      const staffExpired =
        user &&
        user.role !== "client" &&
        typeof auth?.staffExpiresAt === "number" &&
        auth.staffExpiresAt < Date.now();

      const loggedIn = !!user && !staffExpired;

      const isPlatform = pathname.startsWith("/platform");
      const isFirm = FIRM_PREFIXES.some((p) => pathname.startsWith(p));
      const isPortal = pathname.startsWith("/portal");

      if (!isPlatform && !isFirm && !isPortal) return true; // public

      if (!loggedIn) return false; // redirects to /login

      if (isPlatform) return user.role === "platform_owner";
      if (isFirm) return user.role === "firm_admin" || user.role === "associate";
      if (isPortal) return user.role === "client";
      return false;
    },
  },
} satisfies NextAuthConfig;
