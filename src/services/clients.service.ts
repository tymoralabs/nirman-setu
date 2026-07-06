import { and, asc, count, eq, ne } from "drizzle-orm";
import { getDb, schema } from "@/db";
import {
  NotFoundError,
  requireStaff,
  rejectIfSupportReadOnly,
} from "@/lib/authz";
import { enforceLimit } from "@/lib/limits";
import { logActivity } from "@/lib/activity";
import { sendToClient } from "@/lib/notify";
import { ServiceError } from "@/lib/errors";
import { env } from "@/env";

/** Indian mobile in E.164: +91 followed by a 10-digit number starting 6–9. */
export const E164_INDIA = /^\+91[6-9]\d{9}$/;

function assertPhone(phone: string): void {
  if (!E164_INDIA.test(phone)) {
    throw new ServiceError(
      "Phone must be an Indian mobile in +91 format, e.g. +919876543210."
    );
  }
}

async function getFirmName(firmId: string): Promise<string> {
  const db = await getDb();
  const [firm] = await db
    .select({ name: schema.firms.name })
    .from(schema.firms)
    .where(eq(schema.firms.id, firmId))
    .limit(1);
  return firm?.name ?? "Your architect";
}

function sendWelcome(args: {
  firmId: string;
  firmName: string;
  userId: string;
  name: string;
  phone: string;
  email: string | null;
}) {
  void sendToClient({
    firmId: args.firmId,
    recipientUserId: args.userId,
    templateKey: "client_welcome",
    body: `Namaste ${args.name}! ${args.firmName} will collect your project documents through their portal. Sign in with this phone number (OTP, no password): ${env.NEXT_PUBLIC_APP_URL}/login`,
    phone: args.phone,
    email: args.email ?? undefined,
  });
}

// ------------------------------------------------------------------- queries

/** All clients of the firm, with a count of portal logins on each. */
export async function listClients() {
  const staff = await requireStaff();
  const db = await getDb();
  return db
    .select({
      id: schema.clients.id,
      name: schema.clients.name,
      phone: schema.clients.phone,
      email: schema.clients.email,
      whatsappOptIn: schema.clients.whatsappOptIn,
      notes: schema.clients.notes,
      createdAt: schema.clients.createdAt,
      loginCount: count(schema.users.id),
    })
    .from(schema.clients)
    .leftJoin(
      schema.users,
      and(
        eq(schema.users.clientId, schema.clients.id),
        eq(schema.users.role, "client"),
        ne(schema.users.status, "disabled")
      )
    )
    .where(eq(schema.clients.firmId, staff.firmId))
    .groupBy(schema.clients.id)
    .orderBy(asc(schema.clients.name));
}

/** Minimal id/name list for project pickers. */
export async function listClientOptions() {
  const staff = await requireStaff();
  const db = await getDb();
  return db
    .select({ id: schema.clients.id, name: schema.clients.name })
    .from(schema.clients)
    .where(eq(schema.clients.firmId, staff.firmId))
    .orderBy(asc(schema.clients.name));
}

// ----------------------------------------------------------------- mutations

export async function createClient(input: {
  name: string;
  phone: string;
  email?: string | null;
  whatsappOptIn: boolean;
  notes?: string | null;
}) {
  const staff = await requireStaff();
  rejectIfSupportReadOnly(staff);
  assertPhone(input.phone);

  const db = await getDb();
  const [dup] = await db
    .select({ id: schema.clients.id })
    .from(schema.clients)
    .where(
      and(
        eq(schema.clients.firmId, staff.firmId),
        eq(schema.clients.phone, input.phone)
      )
    )
    .limit(1);
  if (dup) {
    throw new ServiceError("A client with this phone number already exists.");
  }

  await enforceLimit(staff.firmId, "clients");

  const [client] = await db
    .insert(schema.clients)
    .values({
      firmId: staff.firmId,
      name: input.name.trim(),
      phone: input.phone,
      email: input.email?.trim() || null,
      whatsappOptIn: input.whatsappOptIn,
      notes: input.notes?.trim() || null,
    })
    .returning();

  await logActivity({
    firmId: staff.firmId,
    actorUserId: staff.id,
    action: "client_created",
    entityType: "client",
    entityId: client.id,
  });

  return { id: client.id };
}

export async function updateClient(
  clientId: string,
  input: {
    name: string;
    phone: string;
    email?: string | null;
    whatsappOptIn: boolean;
    notes?: string | null;
  }
) {
  const staff = await requireStaff();
  rejectIfSupportReadOnly(staff);
  assertPhone(input.phone);

  const db = await getDb();
  const [client] = await db
    .select()
    .from(schema.clients)
    .where(
      and(
        eq(schema.clients.id, clientId),
        eq(schema.clients.firmId, staff.firmId)
      )
    )
    .limit(1);
  if (!client) throw new NotFoundError();

  await db
    .update(schema.clients)
    .set({
      name: input.name.trim(),
      phone: input.phone,
      email: input.email?.trim() || null,
      whatsappOptIn: input.whatsappOptIn,
      notes: input.notes?.trim() || null,
    })
    .where(eq(schema.clients.id, client.id));

  await logActivity({
    firmId: staff.firmId,
    actorUserId: staff.id,
    action: "client_updated",
    entityType: "client",
    entityId: client.id,
  });
}

/**
 * Create the client's OTP portal login (users row role=client). The phone
 * comes from the client record — UNIQUE(firmId, phone) enforced here and in DB.
 */
export async function createClientLogin(clientId: string) {
  const staff = await requireStaff();
  rejectIfSupportReadOnly(staff);

  const db = await getDb();
  const [client] = await db
    .select()
    .from(schema.clients)
    .where(
      and(
        eq(schema.clients.id, clientId),
        eq(schema.clients.firmId, staff.firmId)
      )
    )
    .limit(1);
  if (!client) throw new NotFoundError();
  assertPhone(client.phone);

  const [existing] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(
      and(
        eq(schema.users.firmId, staff.firmId),
        eq(schema.users.role, "client"),
        eq(schema.users.phone, client.phone)
      )
    )
    .limit(1);
  if (existing) {
    throw new ServiceError(
      "A login with this phone number already exists in your firm."
    );
  }

  const [user] = await db
    .insert(schema.users)
    .values({
      firmId: staff.firmId,
      role: "client",
      name: client.name,
      phone: client.phone,
      email: client.email,
      clientId: client.id,
      status: "active",
    })
    .returning();

  await logActivity({
    firmId: staff.firmId,
    actorUserId: staff.id,
    action: "client_login_created",
    entityType: "user",
    entityId: user.id,
    metadata: { clientId: client.id },
  });

  const firmName = await getFirmName(staff.firmId);
  sendWelcome({
    firmId: staff.firmId,
    firmName,
    userId: user.id,
    name: client.name,
    phone: client.phone,
    email: client.email,
  });

  return { id: user.id };
}

/**
 * Second portal login on the same client entity (spouse / co-owner) with a
 * different phone number.
 */
export async function addCoOwnerLogin(
  clientId: string,
  input: { name: string; phone: string }
) {
  const staff = await requireStaff();
  rejectIfSupportReadOnly(staff);
  assertPhone(input.phone);

  const db = await getDb();
  const [client] = await db
    .select()
    .from(schema.clients)
    .where(
      and(
        eq(schema.clients.id, clientId),
        eq(schema.clients.firmId, staff.firmId)
      )
    )
    .limit(1);
  if (!client) throw new NotFoundError();

  const [existing] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(
      and(
        eq(schema.users.firmId, staff.firmId),
        eq(schema.users.role, "client"),
        eq(schema.users.phone, input.phone)
      )
    )
    .limit(1);
  if (existing) {
    throw new ServiceError(
      "A login with this phone number already exists in your firm."
    );
  }

  const [user] = await db
    .insert(schema.users)
    .values({
      firmId: staff.firmId,
      role: "client",
      name: input.name.trim(),
      phone: input.phone,
      clientId: client.id,
      status: "active",
    })
    .returning();

  await logActivity({
    firmId: staff.firmId,
    actorUserId: staff.id,
    action: "client_login_created",
    entityType: "user",
    entityId: user.id,
    metadata: { clientId: client.id, coOwner: true },
  });

  const firmName = await getFirmName(staff.firmId);
  sendWelcome({
    firmId: staff.firmId,
    firmName,
    userId: user.id,
    name: user.name,
    phone: user.phone!,
    email: null,
  });

  return { id: user.id };
}
