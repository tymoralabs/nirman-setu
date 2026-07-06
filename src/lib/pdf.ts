import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

/**
 * Server-side PDF utilities (§2): merge camera photos into a single PDF
 * (§5.2 step 2) and stamp a download watermark (§7 / Phase 7).
 */

/** Merge JPEG/PNG images (in order) into one A4-fitted PDF. */
export async function mergeImagesToPdf(
  images: { data: Uint8Array; mimeType: string }[]
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();

  for (const img of images) {
    const embedded = img.mimeType.includes("png")
      ? await doc.embedPng(img.data)
      : await doc.embedJpg(img.data);

    // A4 portrait in points
    const pageW = 595.28;
    const pageH = 841.89;
    const margin = 24;

    const scale = Math.min(
      (pageW - margin * 2) / embedded.width,
      (pageH - margin * 2) / embedded.height,
      1
    );
    const w = embedded.width * scale;
    const h = embedded.height * scale;

    const page = doc.addPage([pageW, pageH]);
    page.drawImage(embedded, {
      x: (pageW - w) / 2,
      y: (pageH - h) / 2,
      width: w,
      height: h,
    });
  }

  return doc.save();
}

/** Stamp "Downloaded by {name} on {dateIst} via {firm}" on every page. */
export async function watermarkPdf(
  pdfBytes: Uint8Array,
  text: string
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const font = await doc.embedFont(StandardFonts.Helvetica);

  for (const page of doc.getPages()) {
    const { width } = page.getSize();
    const size = 8;
    const textWidth = font.widthOfTextAtSize(text, size);
    page.drawText(text, {
      x: Math.max(8, width - textWidth - 8),
      y: 8,
      size,
      font,
      color: rgb(0.45, 0.45, 0.45),
      opacity: 0.8,
    });
  }

  return doc.save();
}
