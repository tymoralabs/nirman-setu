import { z } from "zod";

/**
 * Environment validation. In local dev almost everything is optional:
 * missing provider keys switch the corresponding module to its mock driver.
 * PGlite (embedded Postgres) is used when DATABASE_URL is not set.
 */
const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  // Database — empty in local dev → PGlite file DB at .data/pglite
  DATABASE_URL: z.string().url().optional(),

  AUTH_SECRET: z.string().min(16).default("dev-only-secret-change-me"),

  // Storage: local (disk, dev) | r2 | s3
  STORAGE_BACKEND: z.enum(["local", "r2", "s3"]).default("local"),
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET_NAME: z.string().optional(),

  // Notifications — absent → mock drivers (console logging)
  MSG91_AUTH_KEY: z.string().optional(),
  MSG91_SMS_TEMPLATE_OTP: z.string().optional(),
  MSG91_SMS_TEMPLATE_NOTICE: z.string().optional(),
  MSG91_WA_NUMBER: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),

  // Billing — absent → mock driver
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),

  // Rate limiting — absent → in-memory driver
  UPSTASH_REDIS_REST_URL: z.string().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),

  SENTRY_DSN: z.string().optional(),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  CRON_SECRET: z.string().default("dev-cron-secret"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error(
    "❌ Invalid environment variables:",
    parsed.error.flatten().fieldErrors
  );
  throw new Error("Invalid environment variables");
}

export const env = parsed.data;

// Strict checks only on a real deployment (Vercel) — a local `next build`
// also runs with NODE_ENV=production but should fall back to PGlite/mocks.
const isDeployed = !!process.env.VERCEL || process.env.ENFORCE_ENV === "1";

if (env.NODE_ENV === "production" && isDeployed) {
  const required: (keyof typeof env)[] = ["DATABASE_URL", "AUTH_SECRET"];
  for (const key of required) {
    if (!env[key]) throw new Error(`Missing required env var in production: ${key}`);
  }
  if (env.AUTH_SECRET === "dev-only-secret-change-me") {
    throw new Error("AUTH_SECRET must be set to a real secret in production");
  }
}
