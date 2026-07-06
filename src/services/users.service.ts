import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { and, asc, eq, gt, ne } from "drizzle-orm";
import { getDb, schema } from "@/db";
import {
  NotFoundError,
  requireFirmAdmin,
  rejectIfSupportReadOnly,
} from "@/lib/authz";
import { enforceLimit } from "@/lib/limits";
import { logActivity } from "@/lib/activity";
import { sendToStaff } from "@/lib/notify";
import { ServiceError } from "@/lib/errors";
import { env } from "@/env";

const INVITE_TTL_MS = 24 * 60 * 60 * 1000; // 24 h single-use invite token
const RESET_TTL_MS = 60 * 60 * 1000; // 1 h reset token
const BCRYPT_COST = 12;

function newToken(): string {
  return randomBytes(32).toString("hex");
}

// ---------------------------------------------------------------- associates

/** Firm admin only: all associates of the firm (any status). */
export async function listAssociates() {
  const admin = await requireFirmAdmin();
  const db = await getDb();
  return db
    .select({
      id: schema.users.id,
      name: schema.users.name,
      email: schema.users.email,
      status: schema.users.status,
      lastLoginAt: schema.users.lastLoginAt,
      createdAt: schema.users.createdAt,
    })
    .from(schema.users)
    .where(
      and(
        eq(schema.users.firmId, admin.firmId),
        eq(schema.users.role, "associate")
      )
    )
    .orderBy(asc(schema.users.name));
}

/** Firm admin only: active associates (for project allocation pickers). */
export async function listActiveAssociates() {
  const admin = await requireFirmAdmin();
  const db = await getDb();
  return db
    .select({
      id: schema.users.id,
      name: schema.users.name,
      email: schema.users.email,
    })
    .from(schema.users)
    .where(
      and(
        eq(schema.users.firmId, admin.firmId),
        eq(schema.users.role, "associate"),
        eq(schema.users.status, "active")
      )
    )
    .orderBy(asc(schema.users.name));
}

/**
 * Invite an associate: creates a `status=invited` user holding a plan seat,
 * with a 24 h single-use token emailed as an accept link (mock driver in dev).
 */
export async function createAssociateInvite(input: {
  name: string;
  email: string;
}) {
  const admin = await requireFirmAdmin();
  rejectIfSupportReadOnly(admin);

  const email = input.email.trim().toLowerCase();
  const db = await getDb();

  // staff emails are globally unique across firms
  const [existing] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(and(eq(schema.users.email, email), ne(schema.users.role, "client")))
    .limit(1);
  if (existing) {
    throw new ServiceError("A staff account with this email already exists.");
  }

  await enforceLimit(admin.firmId, "associates");

  const token = newToken();
  const [user] = await db
    .insert(schema.users)
    .values({
      firmId: admin.firmId,
      role: "associate",
      name: input.name.trim(),
      email,
      status: "invited",
      inviteToken: token,
      inviteTokenExpiresAt: new Date(Date.now() + INVITE_TTL_MS),
    })
    .returning();

  await logActivity({
    firmId: admin.firmId,
    actorUserId: admin.id,
    action: "user_created",
    entityType: "user",
    entityId: user.id,
    metadata: { role: "associate", email },
  });

  const link = `${env.NEXT_PUBLIC_APP_URL}/accept-invite/${token}`;
  void sendToStaff({
    firmId: admin.firmId,
    recipientUserId: user.id,
    templateKey: "staff_invite",
    subject: "You have been invited to join your firm's document portal",
    body: `Hi ${user.name}, you have been invited as an associate. Set your password within 24 hours: ${link}`,
    email,
  });

  return { id: user.id };
}

/** Public: look up a pending invite for the accept page. Null when invalid. */
export async function getInviteByToken(token: string) {
  if (!token) return null;
  const db = await getDb();
  const [user] = await db
    .select({
      name: schema.users.name,
      email: schema.users.email,
    })
    .from(schema.users)
    .where(
      and(
        eq(schema.users.inviteToken, token),
        eq(schema.users.status, "invited"),
        gt(schema.users.inviteTokenExpiresAt, new Date())
      )
    )
    .limit(1);
  return user ?? null;
}

/** Public: consume the invite token, set the password, activate the account. */
export async function acceptInvite(token: string, password: string) {
  const db = await getDb();
  const [user] = await db
    .select()
    .from(schema.users)
    .where(
      and(
        eq(schema.users.inviteToken, token),
        eq(schema.users.status, "invited"),
        gt(schema.users.inviteTokenExpiresAt, new Date())
      )
    )
    .limit(1);

  if (!user) {
    throw new ServiceError("This invite link is invalid or has expired.");
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
  await db
    .update(schema.users)
    .set({
      passwordHash,
      status: "active",
      inviteToken: null,
      inviteTokenExpiresAt: null,
    })
    .where(eq(schema.users.id, user.id));

  await logActivity({
    firmId: user.firmId,
    actorUserId: user.id,
    action: "invite_accepted",
    entityType: "user",
    entityId: user.id,
  });

  return { email: user.email };
}

/** Firm admin only: disable an associate (frees the plan seat). */
export async function disableAssociate(userId: string) {
  const admin = await requireFirmAdmin();
  rejectIfSupportReadOnly(admin);

  const db = await getDb();
  const [user] = await db
    .select()
    .from(schema.users)
    .where(
      and(
        eq(schema.users.id, userId),
        eq(schema.users.firmId, admin.firmId),
        eq(schema.users.role, "associate")
      )
    )
    .limit(1);
  if (!user) throw new NotFoundError();
  if (user.status === "disabled") return;

  await db
    .update(schema.users)
    .set({
      status: "disabled",
      inviteToken: null,
      inviteTokenExpiresAt: null,
      resetToken: null,
      resetTokenExpiresAt: null,
    })
    .where(eq(schema.users.id, user.id));

  await logActivity({
    firmId: admin.firmId,
    actorUserId: admin.id,
    action: "user_disabled",
    entityType: "user",
    entityId: user.id,
  });
}

// ------------------------------------------------------------ password reset

/**
 * Public, staff only. Always resolves without revealing whether the email
 * exists (no account enumeration).
 */
export async function forgotPassword(emailInput: string) {
  const email = emailInput.trim().toLowerCase();
  const db = await getDb();
  const [user] = await db
    .select()
    .from(schema.users)
    .where(
      and(
        eq(schema.users.email, email),
        ne(schema.users.role, "client"),
        eq(schema.users.status, "active")
      )
    )
    .limit(1);
  if (!user) return;

  const token = newToken();
  await db
    .update(schema.users)
    .set({
      resetToken: token,
      resetTokenExpiresAt: new Date(Date.now() + RESET_TTL_MS),
    })
    .where(eq(schema.users.id, user.id));

  await logActivity({
    firmId: user.firmId,
    actorUserId: user.id,
    action: "password_reset_requested",
    entityType: "user",
    entityId: user.id,
  });

  const link = `${env.NEXT_PUBLIC_APP_URL}/reset-password/${token}`;
  void sendToStaff({
    firmId: user.firmId,
    recipientUserId: user.id,
    templateKey: "password_reset",
    subject: "Reset your password",
    body: `Hi ${user.name}, reset your password within 1 hour: ${link}`,
    email,
  });
}

/** Public: is this reset token still usable? (for the reset page) */
export async function isResetTokenValid(token: string): Promise<boolean> {
  if (!token) return false;
  const db = await getDb();
  const [user] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(
      and(
        eq(schema.users.resetToken, token),
        ne(schema.users.role, "client"),
        eq(schema.users.status, "active"),
        gt(schema.users.resetTokenExpiresAt, new Date())
      )
    )
    .limit(1);
  return !!user;
}

/** Public: consume the reset token and set the new password. */
export async function resetPassword(token: string, password: string) {
  const db = await getDb();
  const [user] = await db
    .select()
    .from(schema.users)
    .where(
      and(
        eq(schema.users.resetToken, token),
        ne(schema.users.role, "client"),
        eq(schema.users.status, "active"),
        gt(schema.users.resetTokenExpiresAt, new Date())
      )
    )
    .limit(1);

  if (!user) {
    throw new ServiceError("This reset link is invalid or has expired.");
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
  await db
    .update(schema.users)
    .set({ passwordHash, resetToken: null, resetTokenExpiresAt: null })
    .where(eq(schema.users.id, user.id));

  await logActivity({
    firmId: user.firmId,
    actorUserId: user.id,
    action: "password_reset",
    entityType: "user",
    entityId: user.id,
  });
}
