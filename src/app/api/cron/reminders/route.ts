import { NextRequest, NextResponse } from "next/server";
import { env } from "@/env";
import { sendScheduledReminders } from "@/services/checklists.service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const isLocal = env.NODE_ENV === "development" || env.NODE_ENV === "test";

    if (!isLocal && authHeader !== `Bearer ${env.CRON_SECRET}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const count = await sendScheduledReminders();
    return NextResponse.json({ ok: true, count });
  } catch (err) {
    console.error("Cron reminders failed:", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
