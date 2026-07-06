import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/authz";
import { getStorage } from "@/lib/storage";
import { createDocument } from "@/services/documents.service";
import { mergeImagesToPdf } from "@/lib/pdf";

const completeSchema = z.object({
  checklistItemId: z.string().uuid(),
  fileName: z.string().trim().min(1),
  fileSizeBytes: z.number().int().positive(),
  mimeType: z.string().trim().min(1),
  storageKey: z.string().optional(),
  storageKeys: z.array(z.string()).optional(), // For multi-image PDF merge
});

async function getObjectData(key: string): Promise<Uint8Array> {
  const storage = getStorage();
  if (process.env.STORAGE_BACKEND === "local" || !process.env.STORAGE_BACKEND) {
    const { readFile } = await import("node:fs/promises");
    const { localObjectPath } = await import("@/lib/storage");
    const path = await localObjectPath(key);
    const data = await readFile(path);
    return new Uint8Array(data);
  } else {
    const downloadUrl = await storage.presignDownload(key, "temp");
    const res = await fetch(downloadUrl);
    if (!res.ok) throw new Error(`Failed to fetch storage object: ${res.statusText}`);
    return new Uint8Array(await res.arrayBuffer());
  }
}

async function putObjectData(key: string, data: Uint8Array, mimeType: string) {
  const storage = getStorage();
  if (process.env.STORAGE_BACKEND === "local" || !process.env.STORAGE_BACKEND) {
    const { writeFile, mkdir } = await import("node:fs/promises");
    const { dirname } = await import("node:path");
    const { localObjectPath } = await import("@/lib/storage");
    const path = await localObjectPath(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, data);
  } else {
    const presigned = await storage.presignUpload(key, data.byteLength, mimeType);
    const res = await fetch(presigned.url, {
      method: "PUT",
      headers: presigned.headers,
      body: Buffer.from(data),
    });
    if (!res.ok) throw new Error(`Failed to put storage object: ${res.statusText}`);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const parsed = completeSchema.parse(body);

    const storage = getStorage();
    let finalKey = parsed.storageKey;
    let finalSize = parsed.fileSizeBytes;
    let finalMime = parsed.mimeType;
    let finalName = parsed.fileName;

    if (parsed.storageKeys && parsed.storageKeys.length > 0) {
      // 1. Multi-photo merge flow
      const images: { data: Uint8Array; mimeType: string }[] = [];
      for (const key of parsed.storageKeys) {
        const data = await getObjectData(key);
        // Simple MIME inference from storageKey extension
        const ext = key.split(".").pop()?.toLowerCase();
        const mime = ext === "png" ? "image/png" : "image/jpeg";
        images.push({ data, mimeType: mime });
      }

      // Merge to PDF
      const pdfBytes = await mergeImagesToPdf(images);

      // Generate a new storage key for the merged PDF
      const baseKey = parsed.storageKeys[0];
      const folderPath = baseKey.substring(0, baseKey.lastIndexOf("/"));
      finalKey = `${folderPath}/${crypto.randomUUID()}-${parsed.fileName.replace(/\.[^/.]+$/, "")}.pdf`;
      finalSize = pdfBytes.byteLength;
      finalMime = "application/pdf";
      finalName = parsed.fileName.endsWith(".pdf") ? parsed.fileName : `${parsed.fileName}.pdf`;

      // Upload merged PDF
      await putObjectData(finalKey, pdfBytes, finalMime);

      // Clean up source images
      for (const key of parsed.storageKeys) {
        await storage.deleteObject(key).catch((err) => {
          console.error(`Failed to clean up source image ${key}:`, err);
        });
      }
    } else if (finalKey) {
      // 2. Single file upload verify
      const meta = await storage.headObject(finalKey);
      if (!meta) {
        return NextResponse.json({ error: "file_not_found_in_storage" }, { status: 400 });
      }
      if (meta.sizeBytes !== finalSize) {
        return NextResponse.json({ error: "file_size_mismatch" }, { status: 400 });
      }
    } else {
      return NextResponse.json({ error: "missing_storage_keys" }, { status: 400 });
    }

    // Create document row and update checklist item status
    const doc = await createDocument({
      checklistItemId: parsed.checklistItemId,
      fileName: finalName,
      fileSizeBytes: finalSize,
      mimeType: finalMime,
      storageKey: finalKey,
      uploadedBy: user.id,
    });

    return NextResponse.json({ ok: true, documentId: doc.id });
  } catch (err) {
    console.error("complete API failed:", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
