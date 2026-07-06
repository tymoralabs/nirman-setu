import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireStaff, NotFoundError, rejectIfSupportReadOnly } from "@/lib/authz";
import { getStorage } from "@/lib/storage";
import JSZip from "jszip";
import { logActivity } from "@/lib/activity";

export async function exportClientData(clientId: string): Promise<Buffer> {
  const staff = await requireStaff();
  const db = await getDb();

  // Find client
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

  if (!client) throw new NotFoundError("Client not found");

  // Fetch client user records
  const clientUsers = await db
    .select({
      id: schema.users.id,
      name: schema.users.name,
      email: schema.users.email,
      phone: schema.users.phone,
    })
    .from(schema.users)
    .where(
      and(
        eq(schema.users.clientId, clientId),
        eq(schema.users.firmId, staff.firmId)
      )
    );

  // Fetch projects
  const projects = await db
    .select()
    .from(schema.projects)
    .where(
      and(
        eq(schema.projects.clientId, clientId),
        eq(schema.projects.firmId, staff.firmId)
      )
    );

  const projectIds = projects.map((p) => p.id);

  // Fetch checklists
  const checklists = projectIds.length
    ? await db
        .select()
        .from(schema.checklists)
        .where(
          and(
            eq(schema.checklists.firmId, staff.firmId),
            inArray(schema.checklists.projectId, projectIds)
          )
        )
    : [];

  const checklistIds = checklists.map((c) => c.id);

  // Fetch checklist items
  const items = checklistIds.length
    ? await db
        .select()
        .from(schema.checklistItems)
        .where(inArray(schema.checklistItems.checklistId, checklistIds))
    : [];

  const itemIds = items.map((i) => i.id);

  // Fetch comments
  const comments = itemIds.length
    ? await db
        .select()
        .from(schema.itemComments)
        .where(inArray(schema.itemComments.checklistItemId, itemIds))
    : [];

  // Fetch documents
  const documents = itemIds.length
    ? await db
        .select()
        .from(schema.documents)
        .where(
          and(
            eq(schema.documents.firmId, staff.firmId),
            inArray(schema.documents.checklistItemId, itemIds),
            isNull(schema.documents.deletedAt)
          )
        )
    : [];

  // Construct ZIP file
  const zip = new JSZip();

  // 1. Add metadata JSON
  const metadata = {
    exportedAt: new Date().toISOString(),
    client,
    clientUsers,
    projects,
    checklists,
    items,
    comments,
    documents: documents.map((d) => ({
      id: d.id,
      fileName: d.fileName,
      mimeType: d.mimeType,
      fileSizeBytes: d.fileSizeBytes,
      createdAt: d.createdAt,
    })),
  };

  zip.file("metadata.json", JSON.stringify(metadata, null, 2));

  // 2. Fetch and add each document file
  const storage = getStorage();
  const docsFolder = zip.folder("documents");

  for (const doc of documents) {
    try {
      let data: Uint8Array;
      if (process.env.STORAGE_BACKEND === "local" || !process.env.STORAGE_BACKEND) {
        const { readFile } = await import("node:fs/promises");
        const { localObjectPath } = await import("@/lib/storage");
        const path = await localObjectPath(doc.storageKey);
        data = new Uint8Array(await readFile(path));
      } else {
        const downloadUrl = await storage.presignDownload(doc.storageKey, doc.fileName);
        const res = await fetch(downloadUrl);
        if (!res.ok) throw new Error("Failed to download file");
        data = new Uint8Array(await res.arrayBuffer());
      }
      if (docsFolder) {
        docsFolder.file(`${doc.id}-${doc.fileName}`, data);
      }
    } catch (err) {
      console.warn(`DPDP Export: failed to fetch file for ${doc.fileName}:`, err);
    }
  }

  // Generate buffer
  const content = await zip.generateAsync({ type: "nodebuffer" });
  return content as Buffer;
}

export async function eraseClientData(clientId: string): Promise<void> {
  const staff = await requireStaff();
  rejectIfSupportReadOnly(staff);

  const db = await getDb();

  // Find client
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

  if (!client) throw new NotFoundError("Client not found");

  // Fetch projects
  const projects = await db
    .select({ id: schema.projects.id })
    .from(schema.projects)
    .where(eq(schema.projects.clientId, clientId));

  const projectIds = projects.map((p) => p.id);

  // Fetch checklists
  const checklists = projectIds.length
    ? await db
        .select({ id: schema.checklists.id })
        .from(schema.checklists)
        .where(inArray(schema.checklists.projectId, projectIds))
    : [];

  const checklistIds = checklists.map((c) => c.id);

  // Fetch checklist items
  const items = checklistIds.length
    ? await db
        .select({ id: schema.checklistItems.id })
        .from(schema.checklistItems)
        .where(inArray(schema.checklistItems.checklistId, checklistIds))
    : [];

  const itemIds = items.map((i) => i.id);

  // Fetch documents to delete from storage
  const documents = itemIds.length
    ? await db
        .select({ id: schema.documents.id, storageKey: schema.documents.storageKey, fileSizeBytes: schema.documents.fileSizeBytes })
        .from(schema.documents)
        .where(inArray(schema.documents.checklistItemId, itemIds))
    : [];

  const storage = getStorage();

  // Delete files from storage
  for (const doc of documents) {
    try {
      await storage.deleteObject(doc.storageKey);
    } catch (err) {
      console.warn(`DPDP Erase: failed to delete ${doc.storageKey} from storage:`, err);
    }
  }

  // Delete database records (in order of dependencies)
  if (documents.length > 0) {
    const docIds = documents.map((d) => d.id);
    await db.delete(schema.documents).where(inArray(schema.documents.id, docIds));
  }

  if (itemIds.length > 0) {
    await db.delete(schema.itemComments).where(inArray(schema.itemComments.checklistItemId, itemIds));
    await db.delete(schema.checklistItems).where(inArray(schema.checklistItems.id, itemIds));
  }

  if (checklistIds.length > 0) {
    await db.delete(schema.checklists).where(inArray(schema.checklists.id, checklistIds));
  }

  if (projectIds.length > 0) {
    await db.delete(schema.projectAssignments).where(inArray(schema.projectAssignments.projectId, projectIds));
    await db.delete(schema.projects).where(inArray(schema.projects.id, projectIds));
  }

  // Delete client users
  await db
    .delete(schema.users)
    .where(
      and(
        eq(schema.users.clientId, clientId),
        eq(schema.users.role, "client")
      )
    );

  // Delete client record
  await db
    .delete(schema.clients)
    .where(eq(schema.clients.id, clientId));

  // Log audit activity
  await logActivity({
    firmId: staff.firmId,
    actorUserId: staff.id,
    action: "client_data_deleted",
    entityType: "client",
    entityId: clientId,
    metadata: { clientName: client.name },
  });

  // Update firm's storage usage metrics
  const totalFreedBytes = documents.reduce((acc, curr) => acc + curr.fileSizeBytes, 0);
  if (totalFreedBytes > 0) {
    await db
      .update(schema.firms)
      .set({
        storageUsedBytes: sql`${schema.firms.storageUsedBytes} - ${totalFreedBytes}`,
      })
      .where(eq(schema.firms.id, staff.firmId));
  }
}
