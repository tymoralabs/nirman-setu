import { NextRequest, NextResponse } from "next/server";
import { env } from "@/env";
import { runTrialLifecycle } from "@/services/billing.service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const isLocal = env.NODE_ENV === "development" || env.NODE_ENV === "test";

    if (!isLocal && authHeader !== `Bearer ${env.CRON_SECRET}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const { expiredCount, purgedCount } = await runTrialLifecycle();
    return NextResponse.json({ ok: true, expiredCount, purgedCount });
  } catch (err) {
    console.error("Cron lifecycle failed:", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
