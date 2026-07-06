import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { sql } from "drizzle-orm";
import { getStorage } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function GET() {
  const status = {
    status: "healthy",
    database: "unknown",
    storage: "unknown",
    timestamp: new Date().toISOString(),
  };

  let hasError = false;

  // 1. Check database connection
  try {
    const db = await getDb();
    await db.execute(sql`SELECT 1`);
    status.database = "connected";
  } catch (err) {
    console.error("Health check: DB failure:", err);
    status.database = "failed";
    hasError = true;
  }

  // 2. Check storage connection
  try {
    const storage = getStorage();
    // Verify we can run driver methods (local path exists or R2 credentials work)
    if (process.env.STORAGE_BACKEND === "local" || !process.env.STORAGE_BACKEND) {
      const { stat } = await import("node:fs/promises");
      await stat("./.data/storage").catch(async () => {
        const { mkdir } = await import("node:fs/promises");
        await mkdir("./.data/storage", { recursive: true });
      });
      status.storage = "connected";
    } else {
      // R2 check using headObject for a dummy key (fails gracefully with null or access key error)
      await storage.headObject("healthcheck-dummy-key");
      status.storage = "connected";
    }
  } catch (err) {
    console.error("Health check: Storage failure:", err);
    status.storage = "failed";
    hasError = true;
  }

  if (hasError) {
    status.status = "unhealthy";
    return NextResponse.json(status, { status: 500 });
  }

  return NextResponse.json(status, { status: 200 });
}
