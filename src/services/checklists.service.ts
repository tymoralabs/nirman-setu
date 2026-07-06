import { and, asc, eq, inArray, isNull, sql, desc, ne, gt } from "drizzle-orm";
import { getDb, schema } from "@/db";
import {
  NotFoundError,
  requireUser,
  requireStaff,
  requireProjectAccess,
  rejectIfSupportReadOnly,
} from "@/lib/authz";
import { logActivity } from "@/lib/activity";
import { sendToClient } from "@/lib/notify";
import { ServiceError } from "@/lib/errors";
import { env } from "@/env";

// ------------------------------------------------------------- Checklists CRUD

export async function listChecklistsForProject(projectId: string) {
  const staff = await requireStaff();
  await requireProjectAccess(staff, projectId);
  const db = await getDb();

  return db
    .select()
    .from(schema.checklists)
    .where(
      and(
        eq(schema.checklists.projectId, projectId),
        eq(schema.checklists.firmId, staff.firmId)
      )
    )
    .orderBy(asc(schema.checklists.createdAt));
}

export async function getChecklistDetail(checklistId: string) {
  const user = await requireUser();
  const db = await getDb();

  const [checklist] = await db
    .select()
    .from(schema.checklists)
    .where(eq(schema.checklists.id, checklistId))
    .limit(1);

  if (!checklist) throw new NotFoundError();

  if (user.role === "client") {
    // Check project ownership
    const [project] = await db
      .select({ clientId: schema.projects.clientId })
      .from(schema.projects)
      .where(eq(schema.projects.id, checklist.projectId))
      .limit(1);
    if (!project || project.clientId !== user.clientId) {
      throw new NotFoundError();
    }
    if (checklist.status === "draft") {
      throw new NotFoundError();
    }
  } else {
    // staff
    if (user.firmId !== checklist.firmId) throw new NotFoundError();
    await requireProjectAccess(user, checklist.projectId);
  }

  // Fetch checklist items
  const items = await db
    .select()
    .from(schema.checklistItems)
    .where(eq(schema.checklistItems.checklistId, checklistId))
    .orderBy(asc(schema.checklistItems.sortOrder));

  // Fetch active documents for the checklist items
  const itemIds = items.map((i) => i.id);
  const documents = itemIds.length
    ? await db
        .select()
        .from(schema.documents)
        .where(
          and(
            inArray(schema.documents.checklistItemId, itemIds),
            isNull(schema.documents.deletedAt)
          )
        )
    : [];

  return { checklist, items, documents };
}

export async function createChecklist(input: {
  projectId: string;
  title: string;
  notes?: string | null;
  templateId?: string | null;
  libraryItems?: { libraryItemId: string; isMandatory: boolean }[];
}) {
  const staff = await requireStaff();
  rejectIfSupportReadOnly(staff);
  await requireProjectAccess(staff, input.projectId);
  const db = await getDb();

  const [checklist] = await db
    .insert(schema.checklists)
    .values({
      firmId: staff.firmId,
      projectId: input.projectId,
      title: input.title.trim(),
      notes: input.notes?.trim() || null,
      status: "draft",
      createdBy: staff.id,
    })
    .returning();

  let itemsToInsert: any[] = [];

  if (input.templateId) {
    // Load from template
    const templateItems = await db
      .select({
        libraryItemId: schema.checklistTemplateItems.libraryItemId,
        isMandatory: schema.checklistTemplateItems.isMandatory,
        sortOrder: schema.checklistTemplateItems.sortOrder,
        title: schema.checklistLibraryItems.title,
        titleHi: schema.checklistLibraryItems.titleHi,
        description: schema.checklistLibraryItems.description,
        helpText: schema.checklistLibraryItems.helpText,
      })
      .from(schema.checklistTemplateItems)
      .innerJoin(
        schema.checklistLibraryItems,
        eq(
          schema.checklistTemplateItems.libraryItemId,
          schema.checklistLibraryItems.id
        )
      )
      .where(eq(schema.checklistTemplateItems.templateId, input.templateId))
      .orderBy(asc(schema.checklistTemplateItems.sortOrder));

    itemsToInsert = templateItems.map((ti) => ({
      checklistId: checklist.id,
      libraryItemId: ti.libraryItemId,
      title: ti.title,
      titleHi: ti.titleHi,
      description: ti.description,
      helpText: ti.helpText,
      isMandatory: ti.isMandatory,
      sortOrder: ti.sortOrder,
      status: "pending" as const,
    }));
  } else if (input.libraryItems && input.libraryItems.length > 0) {
    // Load from library items
    const libraryIds = input.libraryItems.map((li) => li.libraryItemId);
    const libItems = await db
      .select()
      .from(schema.checklistLibraryItems)
      .where(
        and(
          inArray(schema.checklistLibraryItems.id, libraryIds),
          eq(schema.checklistLibraryItems.firmId, staff.firmId)
        )
      );

    const libMap = new Map(libItems.map((item) => [item.id, item]));

    itemsToInsert = input.libraryItems.map((li, idx) => {
      const item = libMap.get(li.libraryItemId);
      if (!item) throw new NotFoundError("Library item not found");
      return {
        checklistId: checklist.id,
        libraryItemId: item.id,
        title: item.title,
        titleHi: item.titleHi,
        description: item.description,
        helpText: item.helpText,
        isMandatory: li.isMandatory,
        sortOrder: idx,
        status: "pending" as const,
      };
    });
  }

  if (itemsToInsert.length > 0) {
    await db.insert(schema.checklistItems).values(itemsToInsert);
  }

  await logActivity({
    firmId: staff.firmId,
    actorUserId: staff.id,
    action: "checklist_created",
    entityType: "checklist",
    entityId: checklist.id,
  });

  return { id: checklist.id };
}

export async function sendChecklist(checklistId: string) {
  const staff = await requireStaff();
  rejectIfSupportReadOnly(staff);
  const db = await getDb();

  const [checklist] = await db
    .select()
    .from(schema.checklists)
    .where(
      and(
        eq(schema.checklists.id, checklistId),
        eq(schema.checklists.firmId, staff.firmId)
      )
    )
    .limit(1);

  if (!checklist) throw new NotFoundError();
  await requireProjectAccess(staff, checklist.projectId);

  if (checklist.status !== "draft") {
    throw new ServiceError("Checklist has already been sent.");
  }

  // Get project and client details
  const [project] = await db
    .select()
    .from(schema.projects)
    .where(eq(schema.projects.id, checklist.projectId))
    .limit(1);

  const [client] = await db
    .select()
    .from(schema.clients)
    .where(eq(schema.clients.id, project.clientId))
    .limit(1);

  if (!client) throw new NotFoundError("Client not found");

  // Get client users registered
  const clientUsers = await db
    .select()
    .from(schema.users)
    .where(
      and(
        eq(schema.users.clientId, client.id),
        eq(schema.users.role, "client"),
        eq(schema.users.status, "active")
      )
    );

  await db
    .update(schema.checklists)
    .set({
      status: "sent",
      sentAt: new Date(),
    })
    .where(eq(schema.checklists.id, checklistId));

  // Send notifications to client user(s)
  const portalUrl = `${env.NEXT_PUBLIC_APP_URL}/portal`;
  for (const cu of clientUsers) {
    void sendToClient({
      firmId: staff.firmId,
      recipientUserId: cu.id,
      templateKey: "checklist_sent",
      body: `Hi ${cu.name}, a new document checklist "${checklist.title}" has been sent for project "${project.name}". Upload documents here: ${portalUrl}`,
      phone: cu.phone || undefined,
      email: cu.email || undefined,
    });
  }

  await logActivity({
    firmId: staff.firmId,
    actorUserId: staff.id,
    action: "checklist_sent",
    entityType: "checklist",
    entityId: checklist.id,
  });
}

// -------------------------------------------------------- Checklist Items Review

export async function updateChecklistItemStatus(input: {
  itemId: string;
  status: "pending" | "received" | "rejected" | "waived";
  rejectionReason?: string | null;
  waivedReason?: string | null;
}) {
  const staff = await requireStaff();
  rejectIfSupportReadOnly(staff);
  const db = await getDb();

  // Fetch checklist item and checklist to verify ownership
  const [item] = await db
    .select()
    .from(schema.checklistItems)
    .where(eq(schema.checklistItems.id, input.itemId))
    .limit(1);

  if (!item) throw new NotFoundError();

  const [checklist] = await db
    .select()
    .from(schema.checklists)
    .where(
      and(
        eq(schema.checklists.id, item.checklistId),
        eq(schema.checklists.firmId, staff.firmId)
      )
    )
    .limit(1);

  if (!checklist) throw new NotFoundError();
  await requireProjectAccess(staff, checklist.projectId);

  const updates: Partial<typeof schema.checklistItems.$inferSelect> = {
    status: input.status,
    reviewedBy: staff.id,
    reviewedAt: new Date(),
  };

  let action: "item_received" | "item_rejected" | "item_waived" | "item_unwaived" = "item_received";

  if (input.status === "rejected") {
    if (!input.rejectionReason?.trim()) {
      throw new ServiceError("Rejection reason is required.");
    }
    updates.rejectionReason = input.rejectionReason.trim();
    updates.waivedReason = null;
    action = "item_rejected";

    // Supersede active documents on reject
    await db
      .update(schema.documents)
      .set({ status: "superseded" })
      .where(
        and(
          eq(schema.documents.checklistItemId, item.id),
          eq(schema.documents.status, "active")
        )
      );
  } else if (input.status === "waived") {
    if (!input.waivedReason?.trim()) {
      throw new ServiceError("Waive reason is required.");
    }
    updates.waivedReason = input.waivedReason.trim();
    updates.rejectionReason = null;
    action = "item_waived";
  } else if (input.status === "pending") {
    updates.waivedReason = null;
    updates.rejectionReason = null;
    action = "item_unwaived";
  } else {
    updates.waivedReason = null;
    updates.rejectionReason = null;
  }

  await db
    .update(schema.checklistItems)
    .set(updates)
    .where(eq(schema.checklistItems.id, item.id));

  // Check if checklist is completed (all mandatory items received or waived)
  const allItems = await db
    .select({ isMandatory: schema.checklistItems.isMandatory, status: schema.checklistItems.status })
    .from(schema.checklistItems)
    .where(eq(schema.checklistItems.checklistId, checklist.id));

  const isCompleted = allItems.every(
    (i) => !i.isMandatory || i.status === "received" || i.status === "waived"
  );

  if (isCompleted && checklist.status !== "completed") {
    await db
      .update(schema.checklists)
      .set({ status: "completed", completedAt: new Date() })
      .where(eq(schema.checklists.id, checklist.id));
  } else if (!isCompleted && checklist.status === "completed") {
    // revert completion if a mandatory item is changed back
    await db
      .update(schema.checklists)
      .set({ status: "in_progress", completedAt: null })
      .where(eq(schema.checklists.id, checklist.id));
  }

  await logActivity({
    firmId: staff.firmId,
    actorUserId: staff.id,
    action,
    entityType: "checklist_item",
    entityId: item.id,
    metadata: {
      rejectionReason: updates.rejectionReason,
      waivedReason: updates.waivedReason,
    },
  });

  // Notify client if rejected
  if (input.status === "rejected") {
    const [project] = await db
      .select()
      .from(schema.projects)
      .where(eq(schema.projects.id, checklist.projectId))
      .limit(1);

    const [client] = await db
      .select()
      .from(schema.clients)
      .where(eq(schema.clients.id, project.clientId))
      .limit(1);

    if (client) {
      const clientUsers = await db
        .select()
        .from(schema.users)
        .where(
          and(
            eq(schema.users.clientId, client.id),
            eq(schema.users.role, "client"),
            eq(schema.users.status, "active")
          )
        );

      const portalUrl = `${env.NEXT_PUBLIC_APP_URL}/portal`;
      for (const cu of clientUsers) {
        void sendToClient({
          firmId: staff.firmId,
          recipientUserId: cu.id,
          templateKey: "item_rejected",
          body: `Dear ${cu.name}, the document uploaded for "${item.title}" has been rejected. Reason: ${updates.rejectionReason}. Please re-upload here: ${portalUrl}`,
          phone: cu.phone || undefined,
          email: cu.email || undefined,
        });
      }
    }
  }
}

export async function toggleHardCopyReceived(itemId: string, hardCopyReceived: boolean) {
  const staff = await requireStaff();
  rejectIfSupportReadOnly(staff);
  const db = await getDb();

  const [item] = await db
    .select()
    .from(schema.checklistItems)
    .where(eq(schema.checklistItems.id, itemId))
    .limit(1);

  if (!item) throw new NotFoundError();

  const [checklist] = await db
    .select()
    .from(schema.checklists)
    .where(
      and(
        eq(schema.checklists.id, item.checklistId),
        eq(schema.checklists.firmId, staff.firmId)
      )
    )
    .limit(1);

  if (!checklist) throw new NotFoundError();
  await requireProjectAccess(staff, checklist.projectId);

  await db
    .update(schema.checklistItems)
    .set({
      hardCopyReceived,
      hardCopyNotedBy: hardCopyReceived ? staff.id : null,
      hardCopyNotedAt: hardCopyReceived ? new Date() : null,
    })
    .where(eq(schema.checklistItems.id, itemId));

  await logActivity({
    firmId: staff.firmId,
    actorUserId: staff.id,
    action: "hard_copy_marked",
    entityType: "checklist_item",
    entityId: itemId,
    metadata: { hardCopyReceived },
  });
}

// ----------------------------------------------------------- Comments

export async function addComment(itemId: string, body: string) {
  const user = await requireUser();
  rejectIfSupportReadOnly(user);
  const db = await getDb();

  const [item] = await db
    .select()
    .from(schema.checklistItems)
    .where(eq(schema.checklistItems.id, itemId))
    .limit(1);

  if (!item) throw new NotFoundError();

  const [checklist] = await db
    .select()
    .from(schema.checklists)
    .where(eq(schema.checklists.id, item.checklistId))
    .limit(1);

  if (!checklist) throw new NotFoundError();

  if (user.role === "client") {
    // Check if client owns this project
    const [project] = await db
      .select({ clientId: schema.projects.clientId })
      .from(schema.projects)
      .where(eq(schema.projects.id, checklist.projectId))
      .limit(1);
    if (!project || project.clientId !== user.clientId) {
      throw new NotFoundError();
    }
  } else {
    // staff
    if (user.firmId !== checklist.firmId) throw new NotFoundError();
    await requireProjectAccess(user, checklist.projectId);
  }

  const [comment] = await db
    .insert(schema.itemComments)
    .values({
      checklistItemId: itemId,
      authorUserId: user.id,
      body: body.trim(),
    })
    .returning();

  await logActivity({
    firmId: checklist.firmId,
    actorUserId: user.id,
    action: "comment_added",
    entityType: "comment",
    entityId: comment.id,
  });

  return comment;
}

export async function listComments(itemId: string) {
  const user = await requireUser();
  const db = await getDb();

  const [item] = await db
    .select()
    .from(schema.checklistItems)
    .where(eq(schema.checklistItems.id, itemId))
    .limit(1);

  if (!item) throw new NotFoundError();

  const [checklist] = await db
    .select()
    .from(schema.checklists)
    .where(eq(schema.checklists.id, item.checklistId))
    .limit(1);

  if (!checklist) throw new NotFoundError();

  if (user.role === "client") {
    // Check if client owns this project
    const [project] = await db
      .select({ clientId: schema.projects.clientId })
      .from(schema.projects)
      .where(eq(schema.projects.id, checklist.projectId))
      .limit(1);
    if (!project || project.clientId !== user.clientId) {
      throw new NotFoundError();
    }
  } else {
    // staff
    if (user.firmId !== checklist.firmId) throw new NotFoundError();
    await requireProjectAccess(user, checklist.projectId);
  }

  return db
    .select({
      id: schema.itemComments.id,
      body: schema.itemComments.body,
      createdAt: schema.itemComments.createdAt,
      authorId: schema.users.id,
      authorName: schema.users.name,
      authorRole: schema.users.role,
    })
    .from(schema.itemComments)
    .innerJoin(schema.users, eq(schema.itemComments.authorUserId, schema.users.id))
    .where(eq(schema.itemComments.checklistItemId, itemId))
    .orderBy(asc(schema.itemComments.createdAt));
}

export async function listClientChecklists(clientId: string) {
  const db = await getDb();
  const checklists = await db
    .select({
      id: schema.checklists.id,
      title: schema.checklists.title,
      status: schema.checklists.status,
      createdAt: schema.checklists.createdAt,
      projectName: schema.projects.name,
    })
    .from(schema.checklists)
    .innerJoin(schema.projects, eq(schema.checklists.projectId, schema.projects.id))
    .where(
      and(
        eq(schema.projects.clientId, clientId),
        ne(schema.checklists.status, "draft")
      )
    )
    .orderBy(desc(schema.checklists.createdAt));

  const checklistIds = checklists.map((c) => c.id);
  const items = checklistIds.length
    ? await db
        .select({
          checklistId: schema.checklistItems.checklistId,
          status: schema.checklistItems.status,
          isMandatory: schema.checklistItems.isMandatory,
        })
        .from(schema.checklistItems)
        .where(inArray(schema.checklistItems.checklistId, checklistIds))
    : [];

  const counts = new Map<string, { total: number; completed: number }>();
  for (const item of items) {
    const prev = counts.get(item.checklistId) ?? { total: 0, completed: 0 };
    prev.total++;
    if (item.status === "received" || item.status === "waived") {
      prev.completed++;
    }
    counts.set(item.checklistId, prev);
  }

  return checklists.map((c) => {
    const cnt = counts.get(c.id) ?? { total: 0, completed: 0 };
    return { ...c, totalItems: cnt.total, completedItems: cnt.completed };
  });
}

export async function sendScheduledReminders() {
  const db = await getDb();
  // Fetch active checklists in sent or in_progress
  const activeChecklists = await db
    .select()
    .from(schema.checklists)
    .where(
      and(
        inArray(schema.checklists.status, ["sent", "in_progress"]),
        gt(schema.checklists.reminderCadenceDays, 0)
      )
    );

  const now = new Date();
  let count = 0;

  for (const checklist of activeChecklists) {
    if (checklist.lastReminderAt) {
      const diffMs = now.getTime() - checklist.lastReminderAt.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      if (diffDays < checklist.reminderCadenceDays) {
        continue;
      }
    }

    const pendingItems = await db
      .select()
      .from(schema.checklistItems)
      .where(
        and(
          eq(schema.checklistItems.checklistId, checklist.id),
          eq(schema.checklistItems.isMandatory, true),
          inArray(schema.checklistItems.status, ["pending", "rejected"])
        )
      );

    if (pendingItems.length === 0) continue;

    const itemTitles = pendingItems.map((item) => item.title).join(", ");

    const [project] = await db
      .select()
      .from(schema.projects)
      .where(eq(schema.projects.id, checklist.projectId))
      .limit(1);

    if (!project) continue;

    const [client] = await db
      .select()
      .from(schema.clients)
      .where(eq(schema.clients.id, project.clientId))
      .limit(1);

    if (!client) continue;

    const clientUsers = await db
      .select()
      .from(schema.users)
      .where(
        and(
          eq(schema.users.clientId, client.id),
          eq(schema.users.role, "client"),
          eq(schema.users.status, "active")
        )
      );

    const portalUrl = `${env.NEXT_PUBLIC_APP_URL}/portal`;
    for (const cu of clientUsers) {
      void sendToClient({
        firmId: checklist.firmId,
        recipientUserId: cu.id,
        templateKey: "checklist_reminder",
        body: `Reminder: You have ${pendingItems.length} documents pending for project "${project.name}": ${itemTitles}. Please upload here: ${portalUrl}`,
        phone: cu.phone || undefined,
        email: cu.email || undefined,
      });
    }

    await db
      .update(schema.checklists)
      .set({ lastReminderAt: now })
      .where(eq(schema.checklists.id, checklist.id));

    await logActivity({
      firmId: checklist.firmId,
      actorUserId: null,
      action: "reminder_sent",
      entityType: "checklist",
      entityId: checklist.id,
      metadata: { itemsCount: pendingItems.length },
    });

    count++;
  }

  return count;
}
