import { createHmac, randomInt } from "node:crypto";
import { and, eq, gt, isNull, desc, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { env } from "@/env";
import { sendToClient } from "@/lib/notify";
import { otpSendLimiter } from "@/lib/ratelimit";

/**
 * Client OTP login (§5.1): 6-digit code, 5-min expiry, 3 verify attempts,
 * 30 s resend cooldown, issuance capped at 3 / phone / 15 min.
 *
 * After a successful verify we hand the browser a short-lived signed
 * "ticket" naming the eligible client user ids. The account picker then
 * exchanges (ticket, chosen userId) for a session via the NextAuth
 * client-otp credentials provider — the OTP itself is single-use.
 */

const OTP_TTL_MS = 5 * 60 * 1000;
const RESEND_COOLDOWN_MS = 30 * 1000;
const MAX_VERIFY_ATTEMPTS = 3;
const TICKET_TTL_MS = 5 * 60 * 1000;

function hashCode(code: string): string {
  return createHmac("sha256", env.AUTH_SECRET).update(code).digest("hex");
}

export type SendOtpResult =
  | { ok: true }
  | { ok: false; error: "rate_limited" | "cooldown" };

export async function sendOtp(phone: string): Promise<SendOtpResult> {
  const db = await getDb();

  const { success } = await otpSendLimiter.limit(`otp:${phone}`);
  if (!success) return { ok: false, error: "rate_limited" };

  const [latest] = await db
    .select()
    .from(schema.otpCodes)
    .where(eq(schema.otpCodes.phone, phone))
    .orderBy(desc(schema.otpCodes.createdAt))
    .limit(1);

  if (latest && Date.now() - latest.createdAt.getTime() < RESEND_COOLDOWN_MS) {
    return { ok: false, error: "cooldown" };
  }

  const code = randomInt(100000, 1000000).toString();

  await db.insert(schema.otpCodes).values({
    phone,
    codeHash: hashCode(code),
    purpose: "login",
    expiresAt: new Date(Date.now() + OTP_TTL_MS),
  });

  if (env.NODE_ENV !== "production") {
    console.log(`🔐 [DEV OTP for ${phone}]: ${code}`);
  }

  // fire-and-forget; even if the provider fails, dev console has the code
  void sendToClient({
    firmId: null,
    recipientUserId: null,
    templateKey: "otp_login",
    body: `Your login code is ${code}. Valid for 5 minutes.`,
    phone,
  });

  return { ok: true };
}

export type VerifyOtpResult =
  | { ok: true }
  | { ok: false; error: "invalid" | "expired" | "too_many_attempts" };

export async function verifyOtp(
  phone: string,
  code: string
): Promise<VerifyOtpResult> {
  const db = await getDb();

  const [row] = await db
    .select()
    .from(schema.otpCodes)
    .where(
      and(
        eq(schema.otpCodes.phone, phone),
        isNull(schema.otpCodes.consumedAt),
        gt(schema.otpCodes.expiresAt, new Date())
      )
    )
    .orderBy(desc(schema.otpCodes.createdAt))
    .limit(1);

  if (!row) return { ok: false, error: "expired" };
  if (row.attempts >= MAX_VERIFY_ATTEMPTS)
    return { ok: false, error: "too_many_attempts" };

  await db
    .update(schema.otpCodes)
    .set({ attempts: sql`${schema.otpCodes.attempts} + 1` })
    .where(eq(schema.otpCodes.id, row.id));

  if (hashCode(code) !== row.codeHash) {
    return { ok: false, error: "invalid" };
  }

  await db
    .update(schema.otpCodes)
    .set({ consumedAt: new Date() })
    .where(eq(schema.otpCodes.id, row.id));

  return { ok: true };
}

// ---------- Login ticket (post-OTP, pre-session) ----------

interface TicketPayload {
  phone: string;
  userIds: string[];
  exp: number;
}

function sign(data: string): string {
  return createHmac("sha256", env.AUTH_SECRET + ":ticket")
    .update(data)
    .digest("base64url");
}

export function issueLoginTicket(phone: string, userIds: string[]): string {
  const payload: TicketPayload = {
    phone,
    userIds,
    exp: Date.now() + TICKET_TTL_MS,
  };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${data}.${sign(data)}`;
}

export function readLoginTicket(ticket: string): TicketPayload | null {
  const [data, sig] = ticket.split(".");
  if (!data || !sig) return null;
  if (sign(data) !== sig) return null;
  try {
    const payload = JSON.parse(
      Buffer.from(data, "base64url").toString()
    ) as TicketPayload;
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}
