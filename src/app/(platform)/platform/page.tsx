import { requireRole } from "@/lib/authz";
import { SignOutButton } from "@/components/sign-out-button";
import { getDb, schema } from "@/db";
import { desc, eq, sql } from "drizzle-orm";
import { PlatformView } from "./platform-view";
import { Shield } from "lucide-react";
import { forPage } from "@/lib/action-utils";

export default async function PlatformPage() {
  await forPage(requireRole("platform_owner"));

  const db = await getDb();
  // Fetch firms
  const firms = await db
    .select({
      id: schema.firms.id,
      name: schema.firms.name,
      planTier: schema.firms.planTier,
      status: schema.firms.status,
      storageUsedBytes: schema.firms.storageUsedBytes,
      createdAt: schema.firms.createdAt,
    })
    .from(schema.firms)
    .orderBy(desc(schema.firms.createdAt));

  // Projects count
  const projectCounts = await db
    .select({
      firmId: schema.projects.firmId,
      count: sql<number>`count(${schema.projects.id})`,
    })
    .from(schema.projects)
    .groupBy(schema.projects.firmId);

  const countsMap = new Map<string, number>();
  for (const pc of projectCounts) {
    countsMap.set(pc.firmId, Number(pc.count));
  }

  const mappedFirms = firms.map((f) => ({
    id: f.id,
    name: f.name,
    planTier: f.planTier,
    status: f.status,
    storageUsedBytes: f.storageUsedBytes,
    createdAt: f.createdAt.toISOString(),
    projectsCount: countsMap.get(f.id) ?? 0,
  }));

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Shield className="size-6 text-muted-foreground" />
          Platform Admin
        </h1>
        <SignOutButton />
      </div>

      <PlatformView firms={mappedFirms} />
    </div>
  );
}
