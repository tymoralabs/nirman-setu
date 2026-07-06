import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { getDb, schema } from "@/db";
import type { Role } from "@/auth.config";

/**
 * Central authorization (§3, §7). Every service goes through these.
 * Cross-tenant access → NotFoundError (rendered as 404, never 403).
 */

export class AuthError extends Error {
  constructor(message = "Not authenticated") {
    super(message);
    this.name = "AuthError";
  }
}

export class NotFoundError extends Error {
  constructor(message = "Not found") {
    super(message);
    this.name = "NotFoundError";
  }
}

export class ForbiddenError extends Error {
  constructor(message = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export interface SessionUser {
  id: string;
  role: Role;
  firmId: string | null;
  clientId: string | null;
  name?: string | null;
  supportReadOnly?: boolean;
}

export async function requireUser(): Promise<SessionUser> {
  const session = await auth();
  if (!session?.user) throw new AuthError();
  if (
    session.user.role !== "client" &&
    typeof session.staffExpiresAt === "number" &&
    session.staffExpiresAt < Date.now()
  ) {
    throw new AuthError("Session expired");
  }

  const user = session.user as SessionUser;

  if (user.role === "platform_owner") {
    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();
    const impersonateFirmId = cookieStore.get("impersonate_firm_id")?.value;
    if (impersonateFirmId) {
      return {
        ...user,
        role: "firm_admin",
        firmId: impersonateFirmId,
        supportReadOnly: true,
      };
    }
  }

  return user;
}

export async function requireRole(...roles: Role[]): Promise<SessionUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) throw new NotFoundError();
  return user;
}

/** Staff member of a firm (admin or associate). */
export async function requireStaff(): Promise<SessionUser & { firmId: string }> {
  const user = await requireRole("firm_admin", "associate");
  if (!user.firmId) throw new NotFoundError();
  return user as SessionUser & { firmId: string };
}

export async function requireFirmAdmin(): Promise<SessionUser & { firmId: string }> {
  const user = await requireRole("firm_admin");
  if (!user.firmId) throw new NotFoundError();
  return user as SessionUser & { firmId: string };
}

/**
 * Staff access to a project: admins reach any project in their firm,
 * associates only allocated ones. Cross-tenant / unallocated → NotFound.
 */
export async function requireProjectAccess(
  user: SessionUser,
  projectId: string
) {
  const db = await getDb();
  const [project] = await db
    .select()
    .from(schema.projects)
    .where(
      and(
        eq(schema.projects.id, projectId),
        eq(schema.projects.firmId, user.firmId ?? "")
      )
    )
    .limit(1);

  if (!project) throw new NotFoundError();

  if (user.role === "associate") {
    const [assignment] = await db
      .select()
      .from(schema.projectAssignments)
      .where(
        and(
          eq(schema.projectAssignments.projectId, projectId),
          eq(schema.projectAssignments.userId, user.id)
        )
      )
      .limit(1);
    if (!assignment) throw new NotFoundError();
  }

  return project;
}

/** Support "view as firm" is read-only — call at the top of every mutation. */
export function rejectIfSupportReadOnly(user: SessionUser): void {
  if (user.supportReadOnly) {
    throw new ForbiddenError("Support view is read-only");
  }
}
