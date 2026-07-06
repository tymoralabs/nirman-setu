import * as schema from "./schema";
import { env } from "@/env";

/**
 * Local dev: embedded PGlite (Postgres-in-WASM) persisted at .data/pglite.
 * Production: real Postgres (Supabase) via DATABASE_URL with postgres-js.
 * Cached on globalThis so Next.js hot reload doesn't open multiple handles.
 */

type DrizzleDb = ReturnType<typeof createDb> extends Promise<infer T>
  ? T
  : never;

async function createDb() {
  if (env.DATABASE_URL) {
    const { drizzle } = await import("drizzle-orm/postgres-js");
    const { default: postgres } = await import("postgres");
    const client = postgres(env.DATABASE_URL, { prepare: false });
    return drizzle(client, { schema });
  }
  const { drizzle } = await import("drizzle-orm/pglite");
  const { PGlite } = await import("@electric-sql/pglite");
  const { mkdirSync } = await import("node:fs");
  mkdirSync("./.data", { recursive: true }); // PGlite won't create nested parents
  const pglite = new PGlite("./.data/pglite");
  return drizzle(pglite, { schema });
}

const globalForDb = globalThis as unknown as {
  __db?: Promise<DrizzleDb>;
};

export function getDb(): Promise<DrizzleDb> {
  if (!globalForDb.__db) {
    globalForDb.__db = createDb();
  }
  return globalForDb.__db;
}

export { schema };
export type Db = DrizzleDb;
