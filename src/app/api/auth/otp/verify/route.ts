import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyOtp, issueLoginTicket } from "@/lib/otp";
import { findClientAccountsByPhone } from "@/lib/auth";

const bodySchema = z.object({
  phone: z.string().regex(/^\+91[6-9]\d{9}$/),
  code: z.string().regex(/^\d{6}$/),
});

export async function POST(req: NextRequest) {
  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const { phone, code } = parsed.data;
  const result = await verifyOtp(phone, code);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 401 });
  }

  const accounts = await findClientAccountsByPhone(phone);
  if (accounts.length === 0) {
    return NextResponse.json({ error: "no_account" }, { status: 404 });
  }

  const ticket = issueLoginTicket(
    phone,
    accounts.map((a) => a.userId)
  );

  return NextResponse.json({
    ok: true,
    ticket,
    accounts: accounts.map((a) => ({
      userId: a.userId,
      firmName: a.firmName,
    })),
  });
}
