import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireUser, requireProjectAccess } from "@/lib/authz";
import { getStorage } from "@/lib/storage";
import { watermarkPdf } from "@/lib/pdf";
import { formatDateTimeIst } from "@/lib/dates";
import { logActivity } from "@/lib/activity";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  try {
    const { documentId } = await params;
    const user = await requireUser();
    const db = await getDb();

    // 1. Fetch document, checklist item, checklist, project
    const [doc] = await db
      .select({
        id: schema.documents.id,
        firmId: schema.documents.firmId,
        checklistItemId: schema.documents.checklistItemId,
        fileName: schema.documents.fileName,
        storageKey: schema.documents.storageKey,
        mimeType: schema.documents.mimeType,
        deletedAt: schema.documents.deletedAt,
        projectId: schema.checklists.projectId,
        clientId: schema.projects.clientId,
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
      .where(eq(schema.documents.id, documentId))
      .limit(1);

    if (!doc) {
      return NextResponse.json({ error: "document_not_found" }, { status: 404 });
    }

    // 2. Validate tenant & project authorization
    if (user.role === "client") {
      if (user.clientId !== doc.clientId) {
        return NextResponse.json({ error: "forbidden" }, { status: 403 });
      }
    } else {
      // staff: check if they belong to same firm and have project access
      if (user.firmId !== doc.firmId) {
        return NextResponse.json({ error: "forbidden" }, { status: 403 });
      }
      await requireProjectAccess(user, doc.projectId);
    }

    // 3. Retrieve file from storage
    const storage = getStorage();
    let data: Uint8Array;
    try {
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
    } catch (err) {
      console.error("Storage download failed:", err);
      return NextResponse.json({ error: "file_not_found" }, { status: 404 });
    }

    // 4. PDF Watermark stamping
    let finalData = data;
    if (doc.mimeType === "application/pdf" || doc.fileName.toLowerCase().endsWith(".pdf")) {
      const [firm] = await db
        .select({ name: schema.firms.name })
        .from(schema.firms)
        .where(eq(schema.firms.id, doc.firmId))
        .limit(1);
      const firmName = firm?.name ?? "Firm";
      const dateText = formatDateTimeIst(new Date());
      const watermarkText = `Downloaded by ${user.name ?? "User"} on ${dateText} via ${firmName}`;
      try {
        finalData = await watermarkPdf(data, watermarkText);
      } catch (err) {
        console.error("Failed to watermark PDF:", err);
      }
    }

    // 5. Log activity
    await logActivity({
      firmId: doc.firmId,
      actorUserId: user.id,
      action: "document_downloaded",
      entityType: "document",
      entityId: doc.id,
      metadata: { fileName: doc.fileName },
    });

    return new NextResponse(new Uint8Array(finalData), {
      headers: {
        "Content-Disposition": `attachment; filename="${encodeURIComponent(doc.fileName)}"`,
        "Content-Type": doc.mimeType,
        "Content-Length": String(finalData.byteLength),
      },
    });
  } catch (err) {
    console.error("download API failed:", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
