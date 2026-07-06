import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, requireProjectAccess } from "@/lib/authz";
import { getDb, schema } from "@/db";
import { eq, and } from "drizzle-orm";
import { checkStorageLimit, getMaxFileSizeBytes } from "@/lib/limits";
import { getStorage } from "@/lib/storage";
import { sanitizeFileName } from "@/lib/sanitize";

const presignSchema = z.object({
  checklistItemId: z.string().uuid(),
  fileName: z.string().trim().min(1),
  fileSizeBytes: z.number().int().positive(),
  mimeType: z.string().trim().min(1),
});

const ALLOWED_MIMES = [
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "application/octet-stream", // for dwg / zip sometimes
  "application/x-zip-compressed",
  "application/zip",
];

const ALLOWED_EXTS = ["pdf", "jpg", "jpeg", "png", "webp", "dwg", "zip"];

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const parsed = presignSchema.parse(body);

    const db = await getDb();

    // 1. Fetch item and checklist to authorize
    const [item] = await db
      .select()
      .from(schema.checklistItems)
      .where(eq(schema.checklistItems.id, parsed.checklistItemId))
      .limit(1);

    if (!item) {
      return NextResponse.json({ error: "item_not_found" }, { status: 404 });
    }

    const [checklist] = await db
      .select()
      .from(schema.checklists)
      .where(eq(schema.checklists.id, item.checklistId))
      .limit(1);

    if (!checklist) {
      return NextResponse.json({ error: "checklist_not_found" }, { status: 404 });
    }

    // Authorize project access
    await requireProjectAccess(user, checklist.projectId);

    // Validate checklist status: staff can upload in draft, clients only in sent/in_progress
    if (user.role === "client") {
      if (checklist.status !== "sent" && checklist.status !== "in_progress") {
        return NextResponse.json(
          { error: "checklist_not_open" },
          { status: 403 }
        );
      }
    }

    // Validate file extension
    const ext = parsed.fileName.split(".").pop()?.toLowerCase();
    if (!ext || !ALLOWED_EXTS.includes(ext)) {
      return NextResponse.json({ error: "file_type_not_allowed" }, { status: 400 });
    }

    // Validate file size limit
    const maxFileSize = await getMaxFileSizeBytes(checklist.firmId);
    if (parsed.fileSizeBytes > maxFileSize) {
      return NextResponse.json({ error: "file_too_large" }, { status: 400 });
    }

    // Validate storage limit (check if storage limit exceeded)
    const withinLimit = await checkStorageLimit(
      checklist.firmId,
      parsed.fileSizeBytes
    );
    if (!withinLimit) {
      return NextResponse.json({ error: "storage_quota_exceeded" }, { status: 403 });
    }

    // Sanitize file name
    const sanitizedName = sanitizeFileName(parsed.fileName);
    const storageKey = `${checklist.firmId}/${checklist.projectId}/${checklist.id}/${item.id}/${crypto.randomUUID()}-${sanitizedName}`;

    const storage = getStorage();
    const presigned = await storage.presignUpload(
      storageKey,
      parsed.fileSizeBytes,
      parsed.mimeType
    );

    return NextResponse.json({
      ok: true,
      url: presigned.url,
      method: presigned.method,
      headers: presigned.headers,
      storageKey,
      sanitizedName,
    });
  } catch (err) {
    console.error("presign API failed:", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
