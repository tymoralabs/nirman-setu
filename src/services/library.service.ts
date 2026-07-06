import { and, asc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import {
  NotFoundError,
  requireStaff,
  rejectIfSupportReadOnly,
} from "@/lib/authz";
import { logActivity } from "@/lib/activity";

/**
 * Checklist item library (§3: admins AND associates manage library).
 * Categories are free text — the UI offers suggestions from existing values.
 */

export async function listLibraryItems() {
  const staff = await requireStaff();
  const db = await getDb();
  return db
    .select()
    .from(schema.checklistLibraryItems)
    .where(eq(schema.checklistLibraryItems.firmId, staff.firmId))
    .orderBy(
      asc(schema.checklistLibraryItems.category),
      asc(schema.checklistLibraryItems.title)
    );
}

export async function createLibraryItem(input: {
  title: string;
  titleHi?: string | null;
  category: string;
  helpText?: string | null;
  description?: string | null;
}) {
  const staff = await requireStaff();
  rejectIfSupportReadOnly(staff);

  const db = await getDb();
  const [item] = await db
    .insert(schema.checklistLibraryItems)
    .values({
      firmId: staff.firmId,
      title: input.title.trim(),
      titleHi: input.titleHi?.trim() || null,
      category: input.category.trim(),
      helpText: input.helpText?.trim() || null,
      description: input.description?.trim() || null,
    })
    .returning();

  await logActivity({
    firmId: staff.firmId,
    actorUserId: staff.id,
    action: "library_item_created",
    entityType: "library_item",
    entityId: item.id,
  });

  return { id: item.id };
}

export async function updateLibraryItem(
  itemId: string,
  input: {
    title: string;
    titleHi?: string | null;
    category: string;
    helpText?: string | null;
    description?: string | null;
  }
) {
  const staff = await requireStaff();
  rejectIfSupportReadOnly(staff);

  const db = await getDb();
  const [item] = await db
    .select({ id: schema.checklistLibraryItems.id })
    .from(schema.checklistLibraryItems)
    .where(
      and(
        eq(schema.checklistLibraryItems.id, itemId),
        eq(schema.checklistLibraryItems.firmId, staff.firmId)
      )
    )
    .limit(1);
  if (!item) throw new NotFoundError();

  await db
    .update(schema.checklistLibraryItems)
    .set({
      title: input.title.trim(),
      titleHi: input.titleHi?.trim() || null,
      category: input.category.trim(),
      helpText: input.helpText?.trim() || null,
      description: input.description?.trim() || null,
    })
    .where(eq(schema.checklistLibraryItems.id, item.id));

  await logActivity({
    firmId: staff.firmId,
    actorUserId: staff.id,
    action: "library_item_updated",
    entityType: "library_item",
    entityId: item.id,
  });
}

/** Soft delete / restore via isActive. */
export async function setLibraryItemActive(itemId: string, isActive: boolean) {
  const staff = await requireStaff();
  rejectIfSupportReadOnly(staff);

  const db = await getDb();
  const [item] = await db
    .select({ id: schema.checklistLibraryItems.id })
    .from(schema.checklistLibraryItems)
    .where(
      and(
        eq(schema.checklistLibraryItems.id, itemId),
        eq(schema.checklistLibraryItems.firmId, staff.firmId)
      )
    )
    .limit(1);
  if (!item) throw new NotFoundError();

  await db
    .update(schema.checklistLibraryItems)
    .set({ isActive })
    .where(eq(schema.checklistLibraryItems.id, item.id));

  await logActivity({
    firmId: staff.firmId,
    actorUserId: staff.id,
    action: "library_item_updated",
    entityType: "library_item",
    entityId: item.id,
    metadata: { isActive },
  });
}
