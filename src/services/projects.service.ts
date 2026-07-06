import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { getDb, schema } from "@/db";
import {
  NotFoundError,
  requireFirmAdmin,
  requireProjectAccess,
  requireStaff,
  rejectIfSupportReadOnly,
} from "@/lib/authz";
import { enforceLimit } from "@/lib/limits";
import { logActivity } from "@/lib/activity";

export type ProjectStatus = "active" | "on_hold" | "completed" | "archived";

export interface ProjectListRow {
  id: string;
  name: string;
  city: string | null;
  status: ProjectStatus;
  clientName: string;
  associates: { id: string; name: string }[];
  createdAt: Date;
}

/**
 * Projects visible to the current staff user: admins see the whole firm,
 * associates only their allocated projects (§3).
 */
export async function listProjects(): Promise<ProjectListRow[]> {
  const staff = await requireStaff();
  const db = await getDb();

  const selection = {
    id: schema.projects.id,
    name: schema.projects.name,
    city: schema.projects.city,
    status: schema.projects.status,
    clientName: schema.clients.name,
    createdAt: schema.projects.createdAt,
  };

  const rows =
    staff.role === "associate"
      ? await db
          .select(selection)
          .from(schema.projects)
          .innerJoin(
            schema.clients,
            eq(schema.projects.clientId, schema.clients.id)
          )
          .innerJoin(
            schema.projectAssignments,
            and(
              eq(schema.projectAssignments.projectId, schema.projects.id),
              eq(schema.projectAssignments.userId, staff.id)
            )
          )
          .where(eq(schema.projects.firmId, staff.firmId))
          .orderBy(desc(schema.projects.createdAt))
      : await db
          .select(selection)
          .from(schema.projects)
          .innerJoin(
            schema.clients,
            eq(schema.projects.clientId, schema.clients.id)
          )
          .where(eq(schema.projects.firmId, staff.firmId))
          .orderBy(desc(schema.projects.createdAt));

  const projectIds = rows.map((r) => r.id);
  const assignments = projectIds.length
    ? await db
        .select({
          projectId: schema.projectAssignments.projectId,
          userId: schema.users.id,
          userName: schema.users.name,
        })
        .from(schema.projectAssignments)
        .innerJoin(
          schema.users,
          eq(schema.projectAssignments.userId, schema.users.id)
        )
        .where(inArray(schema.projectAssignments.projectId, projectIds))
    : [];

  const byProject = new Map<string, { id: string; name: string }[]>();
  for (const a of assignments) {
    const list = byProject.get(a.projectId) ?? [];
    list.push({ id: a.userId, name: a.userName });
    byProject.set(a.projectId, list);
  }

  return rows.map((r) => ({ ...r, associates: byProject.get(r.id) ?? [] }));
}

/** Project detail with client info and current allocations. Authz via requireProjectAccess. */
export async function getProjectDetail(projectId: string) {
  const staff = await requireStaff();
  const project = await requireProjectAccess(staff, projectId);
  const db = await getDb();

  const [client] = await db
    .select({
      id: schema.clients.id,
      name: schema.clients.name,
      phone: schema.clients.phone,
      email: schema.clients.email,
      whatsappOptIn: schema.clients.whatsappOptIn,
    })
    .from(schema.clients)
    .where(eq(schema.clients.id, project.clientId))
    .limit(1);
  if (!client) throw new NotFoundError();

  const assignments = await db
    .select({
      userId: schema.users.id,
      name: schema.users.name,
      email: schema.users.email,
      status: schema.users.status,
    })
    .from(schema.projectAssignments)
    .innerJoin(
      schema.users,
      eq(schema.projectAssignments.userId, schema.users.id)
    )
    .where(eq(schema.projectAssignments.projectId, project.id))
    .orderBy(asc(schema.users.name));

  return { project, client, assignments, viewerRole: staff.role };
}

/** Firm admin only (§3). Enforces maxActiveProjects for active projects. */
export async function createProject(input: {
  name: string;
  clientId: string;
  city?: string | null;
  siteAddress?: string | null;
  description?: string | null;
  status?: ProjectStatus;
}) {
  const admin = await requireFirmAdmin();
  rejectIfSupportReadOnly(admin);

  const db = await getDb();
  const [client] = await db
    .select({ id: schema.clients.id })
    .from(schema.clients)
    .where(
      and(
        eq(schema.clients.id, input.clientId),
        eq(schema.clients.firmId, admin.firmId)
      )
    )
    .limit(1);
  if (!client) throw new NotFoundError();

  const status = input.status ?? "active";
  if (status === "active") {
    await enforceLimit(admin.firmId, "projects");
  }

  const [project] = await db
    .insert(schema.projects)
    .values({
      firmId: admin.firmId,
      name: input.name.trim(),
      clientId: input.clientId,
      city: input.city?.trim() || null,
      siteAddress: input.siteAddress?.trim() || null,
      description: input.description?.trim() || null,
      status,
    })
    .returning();

  await logActivity({
    firmId: admin.firmId,
    actorUserId: admin.id,
    action: "project_created",
    entityType: "project",
    entityId: project.id,
  });

  return { id: project.id };
}

/** Firm admin only (§3). Re-activating a project re-checks the plan limit. */
export async function updateProject(
  projectId: string,
  input: {
    name: string;
    clientId: string;
    city?: string | null;
    siteAddress?: string | null;
    description?: string | null;
    status: ProjectStatus;
  }
) {
  const admin = await requireFirmAdmin();
  rejectIfSupportReadOnly(admin);

  const db = await getDb();
  const [project] = await db
    .select()
    .from(schema.projects)
    .where(
      and(
        eq(schema.projects.id, projectId),
        eq(schema.projects.firmId, admin.firmId)
      )
    )
    .limit(1);
  if (!project) throw new NotFoundError();

  const [client] = await db
    .select({ id: schema.clients.id })
    .from(schema.clients)
    .where(
      and(
        eq(schema.clients.id, input.clientId),
        eq(schema.clients.firmId, admin.firmId)
      )
    )
    .limit(1);
  if (!client) throw new NotFoundError();

  if (input.status === "active" && project.status !== "active") {
    await enforceLimit(admin.firmId, "projects");
  }

  await db
    .update(schema.projects)
    .set({
      name: input.name.trim(),
      clientId: input.clientId,
      city: input.city?.trim() || null,
      siteAddress: input.siteAddress?.trim() || null,
      description: input.description?.trim() || null,
      status: input.status,
    })
    .where(eq(schema.projects.id, project.id));

  await logActivity({
    firmId: admin.firmId,
    actorUserId: admin.id,
    action: "project_updated",
    entityType: "project",
    entityId: project.id,
  });
}

/** Firm admin only: allocate an active associate to a project. Idempotent. */
export async function allocateAssociate(projectId: string, userId: string) {
  const admin = await requireFirmAdmin();
  rejectIfSupportReadOnly(admin);
  await requireProjectAccess(admin, projectId);

  const db = await getDb();
  const [associate] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(
      and(
        eq(schema.users.id, userId),
        eq(schema.users.firmId, admin.firmId),
        eq(schema.users.role, "associate"),
        eq(schema.users.status, "active")
      )
    )
    .limit(1);
  if (!associate) throw new NotFoundError();

  await db
    .insert(schema.projectAssignments)
    .values({ projectId, userId, assignedBy: admin.id })
    .onConflictDoNothing();

  await logActivity({
    firmId: admin.firmId,
    actorUserId: admin.id,
    action: "project_allocated",
    entityType: "project",
    entityId: projectId,
    metadata: { associateId: userId },
  });
}

/** Firm admin only: remove an associate from a project. */
export async function deallocateAssociate(projectId: string, userId: string) {
  const admin = await requireFirmAdmin();
  rejectIfSupportReadOnly(admin);
  await requireProjectAccess(admin, projectId);

  const db = await getDb();
  await db
    .delete(schema.projectAssignments)
    .where(
      and(
        eq(schema.projectAssignments.projectId, projectId),
        eq(schema.projectAssignments.userId, userId)
      )
    );

  await logActivity({
    firmId: admin.firmId,
    actorUserId: admin.id,
    action: "project_deallocated",
    entityType: "project",
    entityId: projectId,
    metadata: { associateId: userId },
  });
}
