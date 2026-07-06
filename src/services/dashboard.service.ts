import { and, count, eq, inArray, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireStaff, requireProjectAccess } from "@/lib/authz";

export interface StuckProjectRow {
  id: string;
  name: string;
  clientName: string;
  lastActivityAt: Date | null;
  pendingItemsCount: number;
}

export async function getFirmDashboardStats() {
  const staff = await requireStaff();
  const db = await getDb();

  // 1. Fetch current firm
  const [firm] = await db
    .select({
      id: schema.firms.id,
      planTier: schema.firms.planTier,
      storageUsedBytes: schema.firms.storageUsedBytes,
    })
    .from(schema.firms)
    .where(eq(schema.firms.id, staff.firmId))
    .limit(1);

  if (!firm) throw new Error("Firm not found");

  // 2. Fetch limits
  const [limits] = await db
    .select({ maxStorageBytes: schema.planLimits.maxStorageBytes })
    .from(schema.planLimits)
    .where(eq(schema.planLimits.tier, firm.planTier))
    .limit(1);

  // 3. Active projects query (scope by associate allocation if applicable)
  const projectsSelection = { id: schema.projects.id };
  const activeProjects =
    staff.role === "associate"
      ? await db
          .select(projectsSelection)
          .from(schema.projects)
          .innerJoin(
            schema.projectAssignments,
            eq(schema.projectAssignments.projectId, schema.projects.id)
          )
          .where(
            and(
              eq(schema.projects.firmId, staff.firmId),
              eq(schema.projectAssignments.userId, staff.id),
              eq(schema.projects.status, "active")
            )
          )
      : await db
          .select(projectsSelection)
          .from(schema.projects)
          .where(
            and(
              eq(schema.projects.firmId, staff.firmId),
              eq(schema.projects.status, "active")
            )
          );

  const activeProjectIds = activeProjects.map((p) => p.id);

  // 4. Awaiting review documents count
  let awaitingReviewCount = 0;
  if (activeProjectIds.length > 0) {
    const [row] = await db
      .select({ n: count() })
      .from(schema.checklistItems)
      .innerJoin(
        schema.checklists,
        eq(schema.checklistItems.checklistId, schema.checklists.id)
      )
      .where(
        and(
          inArray(schema.checklists.projectId, activeProjectIds),
          eq(schema.checklistItems.status, "uploaded")
        )
      );
    awaitingReviewCount = row.n;
  }

  // 5. Stuck projects: projects with at least one sent/in_progress checklist
  // where the last upload/comment was more than 7 days ago.
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const stuckProjectsList: StuckProjectRow[] = [];

  if (activeProjectIds.length > 0) {
    const candidateProjects = await db
      .select({
        id: schema.projects.id,
        name: schema.projects.name,
        clientName: schema.clients.name,
        createdAt: schema.projects.createdAt,
      })
      .from(schema.projects)
      .innerJoin(schema.clients, eq(schema.projects.clientId, schema.clients.id))
      .where(inArray(schema.projects.id, activeProjectIds));

    for (const proj of candidateProjects) {
      // Get all sent/in_progress checklists
      const checklists = await db
        .select({ id: schema.checklists.id })
        .from(schema.checklists)
        .where(
          and(
            eq(schema.checklists.projectId, proj.id),
            inArray(schema.checklists.status, ["sent", "in_progress"])
          )
        );

      if (checklists.length === 0) continue;

      const checklistIds = checklists.map((c) => c.id);

      // Check count of pending/rejected mandatory items
      const [pendingRow] = await db
        .select({ n: count() })
        .from(schema.checklistItems)
        .where(
          and(
            inArray(schema.checklistItems.checklistId, checklistIds),
            eq(schema.checklistItems.isMandatory, true),
            inArray(schema.checklistItems.status, ["pending", "rejected"])
          )
        );

      if (pendingRow.n === 0) continue; // All mandatory items are received/waived

      // Find last activity: documents uploaded or comments posted
      const items = await db
        .select({ id: schema.checklistItems.id })
        .from(schema.checklistItems)
        .where(inArray(schema.checklistItems.checklistId, checklistIds));
      const itemIds = items.map((i) => i.id);

      let lastActivityAt: Date | null = null;
      if (itemIds.length > 0) {
        // Last document upload
        const [lastDoc] = await db
          .select({ createdAt: schema.documents.createdAt })
          .from(schema.documents)
          .where(inArray(schema.documents.checklistItemId, itemIds))
          .orderBy(sql`${schema.documents.createdAt} DESC`)
          .limit(1);

        // Last comment
        const [lastComment] = await db
          .select({ createdAt: schema.itemComments.createdAt })
          .from(schema.itemComments)
          .where(inArray(schema.itemComments.checklistItemId, itemIds))
          .orderBy(sql`${schema.itemComments.createdAt} DESC`)
          .limit(1);

        const docTime = lastDoc?.createdAt.getTime() ?? 0;
        const commTime = lastComment?.createdAt.getTime() ?? 0;
        const maxTime = Math.max(docTime, commTime);
        if (maxTime > 0) {
          lastActivityAt = new Date(maxTime);
        }
      }

      // Check if stuck (no activity for 7 days, or never had activity but project created > 7 days ago)
      const activityThreshold = lastActivityAt ?? proj.createdAt;
      if (activityThreshold < sevenDaysAgo) {
        stuckProjectsList.push({
          id: proj.id,
          name: proj.name,
          clientName: proj.clientName,
          lastActivityAt,
          pendingItemsCount: pendingRow.n,
        });
      }
    }
  }

  return {
    activeProjectsCount: activeProjects.length,
    awaitingReviewCount,
    storageUsedBytes: firm.storageUsedBytes,
    maxStorageBytes: limits?.maxStorageBytes ?? 5 * 1024 * 1024 * 1024,
    stuckProjects: stuckProjectsList,
  };
}
