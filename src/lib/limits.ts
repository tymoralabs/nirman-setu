import { and, count, eq, ne } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { ServiceError } from "@/lib/errors";
import type { PlanLimit } from "@/db/schema";

/**
 * Plan-limit enforcement (§4 seeded plan_limits). `-1` means unlimited.
 * Counting rules:
 *  - associates: non-disabled associate users of the firm (invited ones hold a seat)
 *  - projects:   projects with status "active" (maxActiveProjects)
 *  - clients:    all client entities of the firm
 */

export type LimitKind = "associates" | "projects" | "clients";

export interface LimitCheck {
  allowed: boolean;
  current: number;
  /** -1 = unlimited */
  max: number;
}

const LIMIT_NOUNS: Record<LimitKind, string> = {
  associates: "associates",
  projects: "active projects",
  clients: "clients",
};

export class LimitError extends ServiceError {
  readonly kind: LimitKind;
  readonly current: number;
  readonly max: number;

  constructor(kind: LimitKind, check: LimitCheck) {
    super(
      `Your plan allows ${check.max} ${LIMIT_NOUNS[kind]} and you already have ${check.current}. Upgrade your plan to add more.`
    );
    this.name = "LimitError";
    this.kind = kind;
    this.current = check.current;
    this.max = check.max;
  }
}

/** Pure comparison — exported for unit tests. -1 means unlimited. */
export function evaluateLimit(current: number, max: number): LimitCheck {
  if (max === -1) return { allowed: true, current, max };
  return { allowed: current < max, current, max };
}

/** Pure mapping from limit kind to the plan_limits column — exported for tests. */
export function maxForKind(
  limits: Pick<PlanLimit, "maxAssociates" | "maxActiveProjects" | "maxClients">,
  kind: LimitKind
): number {
  switch (kind) {
    case "associates":
      return limits.maxAssociates;
    case "projects":
      return limits.maxActiveProjects;
    case "clients":
      return limits.maxClients;
  }
}

export async function checkLimit(
  firmId: string,
  kind: LimitKind
): Promise<LimitCheck> {
  const db = await getDb();

  const [firm] = await db
    .select({ planTier: schema.firms.planTier })
    .from(schema.firms)
    .where(eq(schema.firms.id, firmId))
    .limit(1);
  if (!firm) throw new Error(`checkLimit: firm ${firmId} not found`);

  const [limits] = await db
    .select()
    .from(schema.planLimits)
    .where(eq(schema.planLimits.tier, firm.planTier))
    .limit(1);
  if (!limits)
    throw new Error(`checkLimit: plan_limits not seeded for tier ${firm.planTier}`);

  let current = 0;
  if (kind === "associates") {
    const [row] = await db
      .select({ n: count() })
      .from(schema.users)
      .where(
        and(
          eq(schema.users.firmId, firmId),
          eq(schema.users.role, "associate"),
          ne(schema.users.status, "disabled")
        )
      );
    current = row.n;
  } else if (kind === "projects") {
    const [row] = await db
      .select({ n: count() })
      .from(schema.projects)
      .where(
        and(
          eq(schema.projects.firmId, firmId),
          eq(schema.projects.status, "active")
        )
      );
    current = row.n;
  } else {
    const [row] = await db
      .select({ n: count() })
      .from(schema.clients)
      .where(eq(schema.clients.firmId, firmId));
    current = row.n;
  }

  return evaluateLimit(current, maxForKind(limits, kind));
}

/** Throws LimitError (friendly, toast-able message) when at/over the limit. */
export async function enforceLimit(
  firmId: string,
  kind: LimitKind
): Promise<void> {
  const check = await checkLimit(firmId, kind);
  if (!check.allowed) throw new LimitError(kind, check);
}

export async function checkStorageLimit(
  firmId: string,
  additionalBytes: number
): Promise<boolean> {
  const db = await getDb();
  const [firm] = await db
    .select({
      planTier: schema.firms.planTier,
      storageUsedBytes: schema.firms.storageUsedBytes,
    })
    .from(schema.firms)
    .where(eq(schema.firms.id, firmId))
    .limit(1);

  if (!firm) throw new Error(`checkStorageLimit: firm ${firmId} not found`);

  const [limits] = await db
    .select({ maxStorageBytes: schema.planLimits.maxStorageBytes })
    .from(schema.planLimits)
    .where(eq(schema.planLimits.tier, firm.planTier))
    .limit(1);

  if (!limits) throw new Error(`checkStorageLimit: plan_limits not seeded for tier ${firm.planTier}`);

  return firm.storageUsedBytes + additionalBytes <= limits.maxStorageBytes;
}

export async function getMaxFileSizeBytes(firmId: string): Promise<number> {
  const db = await getDb();
  const [firm] = await db
    .select({ planTier: schema.firms.planTier })
    .from(schema.firms)
    .where(eq(schema.firms.id, firmId))
    .limit(1);

  if (!firm) throw new Error(`getMaxFileSizeBytes: firm ${firmId} not found`);

  const [limits] = await db
    .select({ maxFileSizeBytes: schema.planLimits.maxFileSizeBytes })
    .from(schema.planLimits)
    .where(eq(schema.planLimits.tier, firm.planTier))
    .limit(1);

  if (!limits) throw new Error(`getMaxFileSizeBytes: plan_limits not seeded`);

  return limits.maxFileSizeBytes;
}

