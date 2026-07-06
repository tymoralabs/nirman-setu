import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { NotFoundError, requireStaff } from "@/lib/authz";

/** Current staff user's firm — used by the (firm) shell layout. */
export async function getCurrentFirm() {
  const user = await requireStaff();
  const db = await getDb();
  const [firm] = await db
    .select({
      id: schema.firms.id,
      name: schema.firms.name,
      planTier: schema.firms.planTier,
    })
    .from(schema.firms)
    .where(eq(schema.firms.id, user.firmId))
    .limit(1);
  if (!firm) throw new NotFoundError();
  return firm;
}
