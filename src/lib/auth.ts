import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { and, eq, ne, inArray, isNull } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { authConfig } from "@/auth.config";
import { readLoginTicket } from "@/lib/otp";

const STAFF_SESSION_MS = 8 * 60 * 60 * 1000;

const staffSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const clientOtpSchema = z.object({
  ticket: z.string().min(1),
  userId: z.string().uuid(),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      id: "staff",
      name: "Staff",
      credentials: { email: {}, password: {} },
      async authorize(credentials) {
        const parsed = staffSchema.safeParse(credentials);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;

        const db = await getDb();
        const [user] = await db
          .select()
          .from(schema.users)
          .where(
            and(
              eq(schema.users.email, email.toLowerCase()),
              ne(schema.users.role, "client"),
              eq(schema.users.status, "active")
            )
          )
          .limit(1);

        if (!user?.passwordHash) return null;
        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        await db
          .update(schema.users)
          .set({ lastLoginAt: new Date() })
          .where(eq(schema.users.id, user.id));

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          firmId: user.firmId,
          clientId: null,
        };
      },
    }),
    Credentials({
      id: "client-otp",
      name: "Client OTP",
      credentials: { ticket: {}, userId: {} },
      async authorize(credentials) {
        const parsed = clientOtpSchema.safeParse(credentials);
        if (!parsed.success) return null;
        const { ticket, userId } = parsed.data;

        const payload = readLoginTicket(ticket);
        if (!payload || !payload.userIds.includes(userId)) return null;

        const db = await getDb();
        const [user] = await db
          .select()
          .from(schema.users)
          .where(
            and(
              eq(schema.users.id, userId),
              eq(schema.users.role, "client"),
              eq(schema.users.status, "active")
            )
          )
          .limit(1);

        if (!user || user.phone !== payload.phone) return null;

        await db
          .update(schema.users)
          .set({ lastLoginAt: new Date() })
          .where(eq(schema.users.id, user.id));

        // DPDP: record consent at first portal login (§5.1)
        if (user.clientId) {
          await db
            .update(schema.clients)
            .set({ dataConsentAt: new Date() })
            .where(
              and(
                eq(schema.clients.id, user.clientId),
                isNull(schema.clients.dataConsentAt)
              )
            );
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          firmId: user.firmId,
          clientId: user.clientId,
        };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
        token.role = user.role;
        token.firmId = user.firmId;
        token.clientId = user.clientId;
        if (user.role !== "client") {
          token.staffExpiresAt = Date.now() + STAFF_SESSION_MS;
        }
      }
      return token;
    },
  },
});

/** Resolve all active client users matching a phone (multi-firm picker, §5.1). */
export async function findClientAccountsByPhone(phone: string) {
  const db = await getDb();
  const rows = await db
    .select({
      userId: schema.users.id,
      name: schema.users.name,
      firmId: schema.users.firmId,
      firmName: schema.firms.name,
    })
    .from(schema.users)
    .innerJoin(schema.firms, eq(schema.users.firmId, schema.firms.id))
    .where(
      and(
        eq(schema.users.phone, phone),
        eq(schema.users.role, "client"),
        eq(schema.users.status, "active"),
        inArray(schema.firms.status, ["active"])
      )
    );
  return rows;
}
