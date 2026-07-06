import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { env } from "@/env";
import { processRazorpayWebhook } from "@/services/billing.service";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-razorpay-signature");

    const bypassVerification =
      !env.RAZORPAY_WEBHOOK_SECRET ||
      env.NODE_ENV === "development" ||
      env.NODE_ENV === "test";

    if (!bypassVerification) {
      if (!signature) {
        return NextResponse.json({ error: "missing_signature" }, { status: 400 });
      }

      const expectedSignature = crypto
        .createHmac("sha256", env.RAZORPAY_WEBHOOK_SECRET!)
        .update(rawBody)
        .digest("hex");

      if (signature !== expectedSignature) {
        return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
      }
    }

    const payload = JSON.parse(rawBody);
    await processRazorpayWebhook(payload);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Razorpay webhook failed:", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
