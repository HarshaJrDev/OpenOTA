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
};
