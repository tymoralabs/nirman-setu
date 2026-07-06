import type { DefaultSession } from "next-auth";
import type { Role } from "@/auth.config";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
      firmId: string | null;
      clientId: string | null;
    } & DefaultSession["user"];
    staffExpiresAt?: number;
  }

  interface User {
    id?: string;
    role: Role;
    firmId: string | null;
    clientId: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    role?: Role;
    firmId?: string | null;
    clientId?: string | null;
    staffExpiresAt?: number;
  }
}
