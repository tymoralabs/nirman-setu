import { eq, and, lte, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { logActivity } from "@/lib/activity";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

export async function processRazorpayWebhook(payload: {
  event: string;
  payload: {
    subscription?: {
      entity: {
        id: string;
        plan_id: string;
        status: string;
      };
    };
    payment?: {
      entity: {
        id: string;
        amount: number; // in paise
        notes: Record<string, string>;
      };
    };
  };
}) {
  const db = await getDb();
  const { event } = payload;

  if (event === "subscription.activated" || event === "subscription.charged") {
    const sub = payload.payload.subscription?.entity;
    if (!sub) return;

    // Find firm with this subscription
    const [firm] = await db
      .select()
      .from(schema.firms)
      .where(eq(schema.firms.razorpaySubscriptionId, sub.id))
      .limit(1);

    if (!firm) {
      console.warn(`Webhook: subscription ${sub.id} not matched to any firm.`);
      return;
    }

    // Map plan_id (or default to gold/platinum based on your setup)
    // For demo purposes, we map plan_id starting with plan_plat to platinum, otherwise gold
    const planTier = sub.plan_id.includes("plat") ? "platinum" : "gold";

    await db
      .update(schema.firms)
      .set({
        planStatus: "active",
        planTier,
        status: "active",
        trialEndsAt: null,
        readOnlySince: null,
        deleteAfter: null,
      })
      .where(eq(schema.firms.id, firm.id));

    await logActivity({
      firmId: firm.id,
      actorUserId: null,
      action: "plan_changed",
      entityType: "firm",
      entityId: firm.id,
      metadata: { subscriptionId: sub.id, event, tier: planTier },
    });
  } else if (
    event === "subscription.halted" ||
    event === "subscription.cancelled"
  ) {
    const sub = payload.payload.subscription?.entity;
    if (!sub) return;

    const [firm] = await db
      .select()
      .from(schema.firms)
      .where(eq(schema.firms.razorpaySubscriptionId, sub.id))
      .limit(1);

    if (!firm) return;

    await db
      .update(schema.firms)
      .set({
        planStatus: event === "subscription.cancelled" ? "cancelled" : "past_due",
        status: "suspended",
        readOnlySince: new Date(),
        deleteAfter: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days to delete
      })
      .where(eq(schema.firms.id, firm.id));

    await logActivity({
      firmId: firm.id,
      actorUserId: null,
      action: "plan_changed",
      entityType: "firm",
      entityId: firm.id,
      metadata: { subscriptionId: sub.id, event },
    });
  }
}

export async function runTrialLifecycle() {
  const db = await getDb();
  const now = new Date();

  // 1. Suspend firms whose trial has expired
  const expiredTrials = await db
    .select()
    .from(schema.firms)
    .where(
      and(
        eq(schema.firms.planStatus, "trialing"),
        eq(schema.firms.status, "active"),
        lte(schema.firms.trialEndsAt, now)
      )
    );

  for (const firm of expiredTrials) {
    await db
      .update(schema.firms)
      .set({
        planStatus: "expired",
        status: "suspended",
        readOnlySince: now,
        deleteAfter: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000), // delete in 30 days
      })
      .where(eq(schema.firms.id, firm.id));

    await logActivity({
      firmId: firm.id,
      actorUserId: null,
      action: "plan_changed",
      entityType: "firm",
      entityId: firm.id,
    });
  }

  // 2. Purge firms soft deleted 30 days ago (deleteAfter <= now)
  const pendingPurges = await db
    .select({ id: schema.firms.id })
    .from(schema.firms)
    .where(
      and(
        eq(schema.firms.status, "suspended"),
        lte(schema.firms.deleteAfter, now)
      )
    );

  for (const p of pendingPurges) {
    // Perform cascading deletions (normally managed by relations or explicitly)
    await db.delete(schema.firms).where(eq(schema.firms.id, p.id));
  }

  return { expiredCount: expiredTrials.length, purgedCount: pendingPurges.length };
}

/** Generates GST-compliant PDF invoice using pdf-lib */
export async function generateInvoicePdf(
  firmName: string,
  state: string | null,
  gstin: string | null,
  planTier: string,
  amountInr: number,
  invoiceNo: string
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.27, 841.89]); // A4 Size

  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // Constants
  const basePrice = Math.round((amountInr / 1.18) * 100) / 100;
  const totalGst = amountInr - basePrice;
  const isSameState = (state || "").toLowerCase().includes("maharashtra"); // Let's assume platform is registered in Maharashtra

  // Top header
  page.drawText("TAX INVOICE", { x: 50, y: 780, size: 20, font: fontBold, color: rgb(0, 0, 0) });
  page.drawText(`Invoice No: ${invoiceNo}`, { x: 50, y: 755, size: 10, font: fontRegular });
  page.drawText(`Date: ${new Date().toLocaleDateString("en-IN")}`, { x: 50, y: 740, size: 10, font: fontRegular });

  // Bill From
  page.drawText("Bill From:", { x: 50, y: 690, size: 11, font: fontBold });
  page.drawText("TymoraLabs Private Limited", { x: 50, y: 675, size: 10, font: fontRegular });
  page.drawText("GSTIN: 27AAAAA1111A1Z1 (Maharashtra)", { x: 50, y: 660, size: 10, font: fontRegular });

  // Bill To
  page.drawText("Bill To:", { x: 300, y: 690, size: 11, font: fontBold });
  page.drawText(firmName, { x: 300, y: 675, size: 10, font: fontRegular });
  page.drawText(`State: ${state || "Not Provided"}`, { x: 300, y: 660, size: 10, font: fontRegular });
  if (gstin) {
    page.drawText(`GSTIN: ${gstin}`, { x: 300, y: 645, size: 10, font: fontRegular });
  }

  // Items table header
  page.drawLine({ start: { x: 50, y: 580 }, end: { x: 545, y: 580 }, thickness: 1, color: rgb(0.8, 0.8, 0.8) });
  page.drawText("Item Description", { x: 55, y: 565, size: 10, font: fontBold });
  page.drawText("SAC Code", { x: 280, y: 565, size: 10, font: fontBold });
  page.drawText("Amount (INR)", { x: 450, y: 565, size: 10, font: fontBold });
  page.drawLine({ start: { x: 50, y: 555 }, end: { x: 545, y: 555 }, thickness: 1, color: rgb(0.8, 0.8, 0.8) });

  // Items row
  page.drawText(`NirmanSetu Liaison SaaS - ${planTier.toUpperCase()} Plan (Monthly)`, { x: 55, y: 535, size: 10, font: fontRegular });
  page.drawText("997331", { x: 280, y: 535, size: 10, font: fontRegular });
  page.drawText(basePrice.toFixed(2), { x: 450, y: 535, size: 10, font: fontRegular });
  page.drawLine({ start: { x: 50, y: 520 }, end: { x: 545, y: 520 }, thickness: 0.5, color: rgb(0.9, 0.9, 0.9) });

  // GST Breakdown
  let currentY = 490;
  page.drawText(`Base Amount:`, { x: 330, y: currentY, size: 10, font: fontRegular });
  page.drawText(basePrice.toFixed(2), { x: 450, y: currentY, size: 10, font: fontRegular });

  if (isSameState) {
    const cgst = totalGst / 2;
    currentY -= 15;
    page.drawText("CGST @ 9%:", { x: 330, y: currentY, size: 10, font: fontRegular });
    page.drawText(cgst.toFixed(2), { x: 450, y: currentY, size: 10, font: fontRegular });

    currentY -= 15;
    page.drawText("SGST @ 9%:", { x: 330, y: currentY, size: 10, font: fontRegular });
    page.drawText(cgst.toFixed(2), { x: 450, y: currentY, size: 10, font: fontRegular });
  } else {
    currentY -= 15;
    page.drawText("IGST @ 18%:", { x: 330, y: currentY, size: 10, font: fontRegular });
    page.drawText(totalGst.toFixed(2), { x: 450, y: currentY, size: 10, font: fontRegular });
  }

  currentY -= 20;
  page.drawLine({ start: { x: 330, y: currentY + 10 }, end: { x: 545, y: currentY + 10 }, thickness: 1, color: rgb(0.8, 0.8, 0.8) });
  page.drawText("Total (Incl. GST):", { x: 330, y: currentY, size: 10, font: fontBold });
  page.drawText(`INR ${amountInr.toFixed(2)}`, { x: 450, y: currentY, size: 10, font: fontBold });

  // Status Stamp
  page.drawText("STATUS: PAID VIA RAZORPAY", {
    x: 50,
    y: 200,
    size: 12,
    font: fontBold,
    color: rgb(0.1, 0.6, 0.2),
  });

  return pdfDoc.save();
}
