import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sendOtp } from "@/lib/otp";

const bodySchema = z.object({
  // Indian mobile in E.164; UI normalizes 10-digit input to +91XXXXXXXXXX
  phone: z.string().regex(/^\+91[6-9]\d{9}$/, "Invalid phone number"),
});

export async function POST(req: NextRequest) {
  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_phone" }, { status: 400 });
  }

  const result = await sendOtp(parsed.data.phone);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 429 });
  }
  // NOTE: same response whether or not the phone has an account —
  // avoids leaking which numbers are registered.
  return NextResponse.json({ ok: true });
}
