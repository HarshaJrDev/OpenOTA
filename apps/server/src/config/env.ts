import path from "node:path";

import { config } from "dotenv";
import { z } from "zod";

// Test runs must never depend on whatever real secrets happen to be sitting in a developer's
// local .env (e.g. real Supabase credentials) — CI and `vitest run` set NODE_ENV=test/production
// explicitly, so only genuinely-local `pnpm dev`/`pnpm start` runs read .env.
if (process.env.NODE_ENV !== "test") {
  config();
}

const envSchema = z
  .object({
    PORT: z.coerce.number().int().positive().default(3001),
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    STORAGE_ROOT: z.string().default(path.resolve(process.cwd(), "storage")),
    STORAGE_PROVIDER: z.enum(["local", "supabase"]).default("local"),
    SUPABASE_URL: z.string().url().optional(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
    SUPABASE_STORAGE_BUCKET: z.string().min(1).default("openota-releases"),
    // Deployment configuration, not an OpenOTA protocol limit — e.g. the Supabase Free plan caps
    // individual objects at 50MB, but a self-hosted local-storage deployment may allow more.
    OPENOTA_MAX_PACKAGE_SIZE_MB: z.coerce.number().positive().default(200),
    // Optional on purpose — self-hosted OpenOTA has no account/org system (see docs/SELF_HOSTING.md
    // "Authentication"). Unset means the API is open, matching a solo-developer/trusted-network
    // deployment; set it to require `Authorization: Bearer <key>` on every mutating request
    // (upload/rollback/delete). This is a single shared secret, not a per-user credential system.
    OPENOTA_API_KEY: z.string().min(1).optional(),
    // Comma-separated allowlist. Unset (default) reflects any origin — acceptable here since
    // there's no cookie/session auth for CORS to leak (the CLI's API key travels as an explicit
    // Authorization header, never ambient browser-sent credentials), and check/list/download are
    // meant to be publicly readable anyway. Set this to restrict the dashboard/browser surface to
    // known origins in a production deployment that wants to be stricter.
    CORS_ALLOWED_ORIGINS: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.STORAGE_PROVIDER !== "supabase") {
      return;
    }

    if (!value.SUPABASE_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["SUPABASE_URL"],
        message: "SUPABASE_URL is required when STORAGE_PROVIDER=supabase",
      });
    }

    if (!value.SUPABASE_SERVICE_ROLE_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["SUPABASE_SERVICE_ROLE_KEY"],
        message: "SUPABASE_SERVICE_ROLE_KEY is required when STORAGE_PROVIDER=supabase",
      });
    }
  });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error("Invalid environment configuration:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = {
  port: parsed.data.PORT,
  nodeEnv: parsed.data.NODE_ENV,
  storageRoot: parsed.data.STORAGE_ROOT,
  storageProvider: parsed.data.STORAGE_PROVIDER,
  supabaseUrl: parsed.data.SUPABASE_URL,
  // Never log this value — server-only secret, must never reach the CLI, SDK, or dashboard.
  supabaseServiceRoleKey: parsed.data.SUPABASE_SERVICE_ROLE_KEY,
  supabaseStorageBucket: parsed.data.SUPABASE_STORAGE_BUCKET,
  maxPackageSizeBytes: Math.floor(parsed.data.OPENOTA_MAX_PACKAGE_SIZE_MB * 1024 * 1024),
  // Never log this value — see the schema comment on OPENOTA_API_KEY above.
  apiKey: parsed.data.OPENOTA_API_KEY,
  corsAllowedOrigins: parsed.data.CORS_ALLOWED_ORIGINS
    ? parsed.data.CORS_ALLOWED_ORIGINS.split(",").map((origin) => origin.trim())
    : undefined,
};
