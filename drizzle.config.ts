import { defineConfig } from "drizzle-kit";

const usePglite = !process.env.DATABASE_URL;

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  ...(usePglite
    ? { driver: "pglite", dbCredentials: { url: "./.data/pglite" } }
    : { dbCredentials: { url: process.env.DATABASE_URL! } }),
});
