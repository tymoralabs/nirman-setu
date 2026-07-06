import { and, eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { NotFoundError, requireUser, rejectIfSupportReadOnly } from "@/lib/authz";
import { logActivity } from "@/lib/activity";

export async function createDocument(input: {
  checklistItemId: string;
  fileName: string;
  fileSizeBytes: number;
  mimeType: string;
  storageKey: string;
  uploadedBy: string;
}) {
  const user = await requireUser();
  rejectIfSupportReadOnly(user);
  const db = await getDb();

  // 1. Fetch checklist item
  const [item] = await db
    .select()
    .from(schema.checklistItems)
    .where(eq(schema.checklistItems.id, input.checklistItemId))
    .limit(1);

  if (!item) throw new NotFoundError("Checklist item not found");

  // 2. Fetch checklist
  const [checklist] = await db
    .select()
    .from(schema.checklists)
    .where(eq(schema.checklists.id, item.checklistId))
    .limit(1);

  if (!checklist) throw new NotFoundError("Checklist not found");

  // 3. Insert document row
  const [doc] = await db
    .insert(schema.documents)
    .values({
      firmId: checklist.firmId,
      checklistItemId: input.checklistItemId,
      uploadedBy: input.uploadedBy,
      fileName: input.fileName,
      fileSizeBytes: input.fileSizeBytes,
      mimeType: input.mimeType,
      storageKey: input.storageKey,
      version: 1, // we can support version increment in client portal
      status: "active",
    })
    .returning();

  // 4. Update item status to "uploaded"
  await db
    .update(schema.checklistItems)
    .set({ status: "uploaded" })
    .where(eq(schema.checklistItems.id, item.id));

  // 5. Update firm storage allocation atomically
  await db
    .update(schema.firms)
    .set({
      storageUsedBytes: sql`${schema.firms.storageUsedBytes} + ${input.fileSizeBytes}`,
    })
    .where(eq(schema.firms.id, checklist.firmId));

  // 6. Log activity
  const onBehalf = user.role !== "client";
  await logActivity({
    firmId: checklist.firmId,
    actorUserId: user.id,
    action: "document_uploaded",
    entityType: "document",
    entityId: doc.id,
    metadata: {
      onBehalf,
      itemId: item.id,
      fileName: input.fileName,
    },
  });

  return doc;
}
