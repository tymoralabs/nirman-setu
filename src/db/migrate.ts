import { config } from "dotenv";
config({ path: ".env" });

async function main() {
  if (process.env.DATABASE_URL) {
    const { drizzle } = await import("drizzle-orm/postgres-js");
    const { migrate } = await import("drizzle-orm/postgres-js/migrator");
    const { default: postgres } = await import("postgres");
    const client = postgres(process.env.DATABASE_URL, { max: 1 });
    const db = drizzle(client);
    await migrate(db, { migrationsFolder: "./drizzle" });
    await client.end();
  } else {
    const { drizzle } = await import("drizzle-orm/pglite");
    const { migrate } = await import("drizzle-orm/pglite/migrator");
    const { PGlite } = await import("@electric-sql/pglite");
    const pglite = new PGlite("./.data/pglite");
    const db = drizzle(pglite);
    await migrate(db, { migrationsFolder: "./drizzle" });
    await pglite.close();
  }
  console.log("✅ Migrations applied");
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
