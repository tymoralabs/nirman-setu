import { and, eq, lt, isNotNull, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { NotFoundError, requireStaff, rejectIfSupportReadOnly } from "@/lib/authz";
import { logActivity } from "@/lib/activity";
import { getStorage } from "@/lib/storage";

export async function listTrashItems() {
  const staff = await requireStaff();
  const db = await getDb();

  return db
    .select({
      id: schema.documents.id,
      fileName: schema.documents.fileName,
      fileSizeBytes: schema.documents.fileSizeBytes,
      mimeType: schema.documents.mimeType,
      deletedAt: schema.documents.deletedAt,
      itemTitle: schema.checklistItems.title,
      projectName: schema.projects.name,
    })
    .from(schema.documents)
    .innerJoin(
      schema.checklistItems,
      eq(schema.documents.checklistItemId, schema.checklistItems.id)
    )
    .innerJoin(
      schema.checklists,
      eq(schema.checklistItems.checklistId, schema.checklists.id)
    )
    .innerJoin(
      schema.projects,
      eq(schema.checklists.projectId, schema.projects.id)
    )
    .where(
      and(
        eq(schema.documents.firmId, staff.firmId),
        isNotNull(schema.documents.deletedAt)
      )
    )
    .orderBy(schema.documents.deletedAt);
}

export async function restoreDocument(documentId: string) {
  const staff = await requireStaff();
  rejectIfSupportReadOnly(staff);
  const db = await getDb();

  const [doc] = await db
    .select()
    .from(schema.documents)
    .where(
      and(
        eq(schema.documents.id, documentId),
        eq(schema.documents.firmId, staff.firmId)
      )
    )
    .limit(1);

  if (!doc || !doc.deletedAt) throw new NotFoundError();

  await db
    .update(schema.documents)
    .set({ deletedAt: null })
    .where(eq(schema.documents.id, doc.id));

  await logActivity({
    firmId: staff.firmId,
    actorUserId: staff.id,
    action: "document_restored",
    entityType: "document",
    entityId: doc.id,
  });
}

/** Soft-delete a document: sets deletedAt = now. */
export async function softDeleteDocument(documentId: string) {
  const staff = await requireStaff();
  rejectIfSupportReadOnly(staff);
  const db = await getDb();

  const [doc] = await db
    .select()
    .from(schema.documents)
    .where(
      and(
        eq(schema.documents.id, documentId),
        eq(schema.documents.firmId, staff.firmId)
      )
    )
    .limit(1);

  if (!doc || doc.deletedAt) throw new NotFoundError();

  await db
    .update(schema.documents)
    .set({ deletedAt: new Date() })
    .where(eq(schema.documents.id, doc.id));

  await logActivity({
    firmId: staff.firmId,
    actorUserId: staff.id,
    action: "document_deleted",
    entityType: "document",
    entityId: doc.id,
  });
}

/** Cron only: purge trash documents older than 30 days. */
export async function purgeOldTrash() {
  const db = await getDb();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const oldDocs = await db
    .select()
    .from(schema.documents)
    .where(lt(schema.documents.deletedAt, thirtyDaysAgo));

  const storage = getStorage();

  for (const doc of oldDocs) {
    try {
      // 1. Delete from physical storage (R2/local disk)
      await storage.deleteObject(doc.storageKey);

      // 2. Decrement storage usage for firm atomically
      await db
        .update(schema.firms)
        .set({
          storageUsedBytes: sql`GREATEST(0, ${schema.firms.storageUsedBytes} - ${doc.fileSizeBytes})`,
        })
        .where(eq(schema.firms.id, doc.firmId));

      // 3. Delete from DB
      await db.delete(schema.documents).where(eq(schema.documents.id, doc.id));

      console.log(`Purged document ${doc.id} (${doc.fileName}) from firm ${doc.firmId}`);
    } catch (err) {
      console.error(`Failed to purge document ${doc.id}:`, err);
    }
  }
}
