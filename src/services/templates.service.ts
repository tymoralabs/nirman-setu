import { and, asc, count, eq, inArray } from "drizzle-orm";
import { getDb, schema } from "@/db";
import {
  NotFoundError,
  requireStaff,
  rejectIfSupportReadOnly,
} from "@/lib/authz";
import { logActivity } from "@/lib/activity";
import { ServiceError } from "@/lib/errors";

/**
 * Checklist templates (§3: admins AND associates manage templates).
 * A template is an ordered list of library items with a mandatory flag.
 */

export interface TemplateItemInput {
  libraryItemId: string;
  isMandatory: boolean;
}

export async function listTemplates() {
  const staff = await requireStaff();
  const db = await getDb();
  return db
    .select({
      id: schema.checklistTemplates.id,
      name: schema.checklistTemplates.name,
      description: schema.checklistTemplates.description,
      isActive: schema.checklistTemplates.isActive,
      itemCount: count(schema.checklistTemplateItems.id),
    })
    .from(schema.checklistTemplates)
    .leftJoin(
      schema.checklistTemplateItems,
      eq(schema.checklistTemplateItems.templateId, schema.checklistTemplates.id)
    )
    .where(eq(schema.checklistTemplates.firmId, staff.firmId))
    .groupBy(schema.checklistTemplates.id)
    .orderBy(asc(schema.checklistTemplates.name));
}

/** Templates with their ordered items — powers the templates page + editor. */
export async function listTemplatesWithItems() {
  const staff = await requireStaff();
  const db = await getDb();

  const templates = await db
    .select()
    .from(schema.checklistTemplates)
    .where(eq(schema.checklistTemplates.firmId, staff.firmId))
    .orderBy(asc(schema.checklistTemplates.name));

  const templateIds = templates.map((t) => t.id);
  const items = templateIds.length
    ? await db
        .select({
          templateId: schema.checklistTemplateItems.templateId,
          libraryItemId: schema.checklistTemplateItems.libraryItemId,
          isMandatory: schema.checklistTemplateItems.isMandatory,
          sortOrder: schema.checklistTemplateItems.sortOrder,
          title: schema.checklistLibraryItems.title,
          category: schema.checklistLibraryItems.category,
        })
        .from(schema.checklistTemplateItems)
        .innerJoin(
          schema.checklistLibraryItems,
          eq(
            schema.checklistTemplateItems.libraryItemId,
            schema.checklistLibraryItems.id
          )
        )
        .where(inArray(schema.checklistTemplateItems.templateId, templateIds))
        .orderBy(asc(schema.checklistTemplateItems.sortOrder))
    : [];

  const byTemplate = new Map<string, typeof items>();
  for (const item of items) {
    const list = byTemplate.get(item.templateId) ?? [];
    list.push(item);
    byTemplate.set(item.templateId, list);
  }

  return templates.map((t) => ({
    ...t,
    items: byTemplate.get(t.id) ?? [],
  }));
}

export async function getTemplate(templateId: string) {
  const staff = await requireStaff();
  const db = await getDb();

  const [template] = await db
    .select()
    .from(schema.checklistTemplates)
    .where(
      and(
        eq(schema.checklistTemplates.id, templateId),
        eq(schema.checklistTemplates.firmId, staff.firmId)
      )
    )
    .limit(1);
  if (!template) throw new NotFoundError();

  const items = await db
    .select({
      id: schema.checklistTemplateItems.id,
      libraryItemId: schema.checklistTemplateItems.libraryItemId,
      isMandatory: schema.checklistTemplateItems.isMandatory,
      sortOrder: schema.checklistTemplateItems.sortOrder,
      title: schema.checklistLibraryItems.title,
      category: schema.checklistLibraryItems.category,
    })
    .from(schema.checklistTemplateItems)
    .innerJoin(
      schema.checklistLibraryItems,
      eq(
        schema.checklistTemplateItems.libraryItemId,
        schema.checklistLibraryItems.id
      )
    )
    .where(eq(schema.checklistTemplateItems.templateId, template.id))
    .orderBy(asc(schema.checklistTemplateItems.sortOrder));

  return { template, items };
}

/** All library items must belong to the caller's firm (cross-tenant → 404). */
async function assertLibraryItemsInFirm(
  firmId: string,
  libraryItemIds: string[]
): Promise<void> {
  if (libraryItemIds.length === 0) return;
  const db = await getDb();
  const rows = await db
    .select({ id: schema.checklistLibraryItems.id })
    .from(schema.checklistLibraryItems)
    .where(
      and(
        eq(schema.checklistLibraryItems.firmId, firmId),
        inArray(schema.checklistLibraryItems.id, libraryItemIds)
      )
    );
  if (rows.length !== new Set(libraryItemIds).size) throw new NotFoundError();
}

export async function createTemplate(input: {
  name: string;
  description?: string | null;
  items: TemplateItemInput[];
}) {
  const staff = await requireStaff();
  rejectIfSupportReadOnly(staff);
  if (input.items.length === 0) {
    throw new ServiceError("Pick at least one library item for the template.");
  }
  await assertLibraryItemsInFirm(
    staff.firmId,
    input.items.map((i) => i.libraryItemId)
  );

  const db = await getDb();
  const [template] = await db
    .insert(schema.checklistTemplates)
    .values({
      firmId: staff.firmId,
      name: input.name.trim(),
      description: input.description?.trim() || null,
    })
    .returning();

  await db.insert(schema.checklistTemplateItems).values(
    input.items.map((item, i) => ({
      templateId: template.id,
      libraryItemId: item.libraryItemId,
      isMandatory: item.isMandatory,
      sortOrder: i,
    }))
  );

  await logActivity({
    firmId: staff.firmId,
    actorUserId: staff.id,
    action: "template_created",
    entityType: "template",
    entityId: template.id,
  });

  return { id: template.id };
}

export async function updateTemplate(
  templateId: string,
  input: {
    name: string;
    description?: string | null;
    items: TemplateItemInput[];
  }
) {
  const staff = await requireStaff();
  rejectIfSupportReadOnly(staff);
  if (input.items.length === 0) {
    throw new ServiceError("Pick at least one library item for the template.");
  }

  const db = await getDb();
  const [template] = await db
    .select({ id: schema.checklistTemplates.id })
    .from(schema.checklistTemplates)
    .where(
      and(
        eq(schema.checklistTemplates.id, templateId),
        eq(schema.checklistTemplates.firmId, staff.firmId)
      )
    )
    .limit(1);
  if (!template) throw new NotFoundError();

  await assertLibraryItemsInFirm(
    staff.firmId,
    input.items.map((i) => i.libraryItemId)
  );

  await db
    .update(schema.checklistTemplates)
    .set({
      name: input.name.trim(),
      description: input.description?.trim() || null,
    })
    .where(eq(schema.checklistTemplates.id, template.id));

  // replace the item set (templates are not yet referenced by checklists —
  // Phase 3 checklists snapshot items, so replacing here is safe)
  await db
    .delete(schema.checklistTemplateItems)
    .where(eq(schema.checklistTemplateItems.templateId, template.id));
  await db.insert(schema.checklistTemplateItems).values(
    input.items.map((item, i) => ({
      templateId: template.id,
      libraryItemId: item.libraryItemId,
      isMandatory: item.isMandatory,
      sortOrder: i,
    }))
  );

  await logActivity({
    firmId: staff.firmId,
    actorUserId: staff.id,
    action: "template_updated",
    entityType: "template",
    entityId: template.id,
  });
}

/** Soft delete / restore via isActive. */
export async function setTemplateActive(templateId: string, isActive: boolean) {
  const staff = await requireStaff();
  rejectIfSupportReadOnly(staff);

  const db = await getDb();
  const [template] = await db
    .select({ id: schema.checklistTemplates.id })
    .from(schema.checklistTemplates)
    .where(
      and(
        eq(schema.checklistTemplates.id, templateId),
        eq(schema.checklistTemplates.firmId, staff.firmId)
      )
    )
    .limit(1);
  if (!template) throw new NotFoundError();

  await db
    .update(schema.checklistTemplates)
    .set({ isActive })
    .where(eq(schema.checklistTemplates.id, template.id));

  await logActivity({
    firmId: staff.firmId,
    actorUserId: staff.id,
    action: "template_updated",
    entityType: "template",
    entityId: template.id,
    metadata: { isActive },
  });
}
