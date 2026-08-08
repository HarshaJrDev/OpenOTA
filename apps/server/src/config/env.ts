import { randomBytes } from "node:crypto";
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
    // Multi-tenant metadata (users/projects/api keys/releases) only — OTA package bytes still
    // live entirely in StorageProvider. SQLite by default so self-hosting needs zero extra
    // infrastructure; a deployment that never creates a project/dashboard user never touches this
    // beyond the one-time schema bootstrap, and the legacy global-OPENOTA_API_KEY flat routes are
    // completely unaffected either way.
    DATABASE_URL: z.string().min(1).optional(),
    // Signs dashboard session cookies (HMAC, not a full JWT library — see auth/session.ts). Must
    // be set explicitly in production; a random per-boot value in dev/test is fine since that just
    // invalidates sessions on restart, never a security issue for a throwaway dev secret.
    SESSION_SECRET: z.string().min(16).optional(),
    // Comma-separated allowlist. Unset (default) reflects any origin — acceptable here since
    // there's no cookie/session auth for CORS to leak (the CLI's API key travels as an explicit
    // Authorization header, never ambient browser-sent credentials), and check/list/download are
    // meant to be publicly readable anyway. Set this to restrict the dashboard/browser surface to
    // known origins in a production deployment that wants to be stricter.
    CORS_ALLOWED_ORIGINS: z.string().optional(),
    // Comma-separated allowlist of emails granted admin endpoints (currently just the runtime
    // settings toggle — see modules/admin/). No roles/permissions table on purpose: this is the
    // same "one operator-controlled env var, no account/org system" philosophy as OPENOTA_API_KEY,
    // scaled to as many trusted humans as the operator lists. Unset means nobody is an admin.
    ADMIN_EMAILS: z.string().optional(),
    // Email delivery for verification/reset links, via Resend's HTTP API (no SMTP setup, no extra
    // dependency — one fetch() call). Optional: unset means links are logged to the server console
    // instead of emailed, which keeps self-hosted/dev deployments fully usable with zero email
    // infrastructure — verification/reset still work, an operator just reads the link from logs.
    RESEND_API_KEY: z.string().min(1).optional(),
    // SMTP fallback (e.g. Gmail with an App Password) for operators who'd rather not sign up for
    // Resend. Used only when RESEND_API_KEY is unset — see email.service.ts's sendEmail() for the
    // precedence. All four must be set together for SMTP to activate; a partial config is treated
    // as "not configured" (falls through to log-only) rather than a startup error, matching every
    // other optional integration in this file.
    SMTP_HOST: z.string().min(1).optional(),
    SMTP_PORT: z.coerce.number().int().positive().default(587),
    SMTP_USER: z.string().min(1).optional(),
    SMTP_PASS: z.string().min(1).optional(),
    // true for port 465 (implicit TLS); false (default) uses STARTTLS on 587, which is what
    // Gmail's smtp.gmail.com + an App Password expects.
    SMTP_SECURE: z
      .string()
      .optional()
      .transform((v) => v === "true"),
    EMAIL_FROM: z.string().email().default("OpenOTA <onboarding@resend.dev>"),
    // Public URL of the dashboard, used to build verify-email/reset-password links. Falls back to
    // the Vercel-hosted dashboard so a deployment that never sets this still produces working links.
    DASHBOARD_URL: z.string().url().default("https://open-ota-dashboard.vercel.app"),
    // Optional — unset means no error tracking, just the existing pino logs (see config/sentry.ts).
    SENTRY_DSN: z.string().url().optional(),
    // DEV MODE default: false. Signup/login have never gated on email_verified — this flag exists
    // so a production deployment can opt INTO enforcing it later without a code change, not the
    // other way around. See auth/service.ts's login() for the actual gate.
    REQUIRE_EMAIL_VERIFICATION: z
      .string()
      .optional()
      .transform((v) => v === "true"),
    // DEV MODE ONLY — never seeds when NODE_ENV=production, regardless of this flag. See
    // db/seed.ts. Off by default even in dev so an operator has to opt in explicitly.
    SEED_DEMO_ACCOUNT: z
      .string()
      .optional()
      .transform((v) => v === "true"),
    // Google OAuth sign-in — additive to email/password, never required. All three or none: see
    // the superRefine below. GOOGLE_REDIRECT_URI must exactly match a URI registered on the
    // Google Cloud OAuth client (there's no "server public URL" env var to derive this from, so
    // it's explicit rather than guessed from request headers, which can't be trusted behind a
    // proxy). See auth/google.ts.
    GOOGLE_CLIENT_ID: z.string().min(1).optional(),
    GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
    GOOGLE_REDIRECT_URI: z.string().url().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.STORAGE_PROVIDER === "supabase") {
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
    }

    const googleFields = [value.GOOGLE_CLIENT_ID, value.GOOGLE_CLIENT_SECRET, value.GOOGLE_REDIRECT_URI];
    const googleFieldsSet = googleFields.filter((field) => field !== undefined).length;
    if (googleFieldsSet !== 0 && googleFieldsSet !== googleFields.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["GOOGLE_CLIENT_ID"],
        message: "GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI must all be set together, or none of them",
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
  // Unset → embedded PGlite (tests: in-memory; otherwise a local ./data/pgdata directory).
  // `postgres://…` → managed Postgres (Supabase in production). See db/client.ts. Defaults are
  // resolved there, not here, so this is a straight pass-through.
  databaseUrl: parsed.data.DATABASE_URL,
  // Never log this value. A missing SESSION_SECRET in production is a real misconfiguration
  // (every restart would silently invalidate all dashboard sessions with a new random secret,
  // and worse, an attacker who can predict process-start timing gains no advantage since this
  // is still cryptographically random — but it's still wrong to run production without pinning
  // it), so fail loudly instead of booting on a value nobody chose.
  sessionSecret:
    parsed.data.SESSION_SECRET ??
    (parsed.data.NODE_ENV === "production"
      ? (() => {
          throw new Error("SESSION_SECRET is required when NODE_ENV=production");
        })()
      : randomBytes(32).toString("hex")),
  corsAllowedOrigins: parsed.data.CORS_ALLOWED_ORIGINS
    ? parsed.data.CORS_ALLOWED_ORIGINS.split(",").map((origin) => origin.trim())
    : undefined,
  adminEmails: new Set(
    (parsed.data.ADMIN_EMAILS ?? "").split(",").map((email) => email.trim().toLowerCase()).filter(Boolean),
  ),
  // Never log this value — server-only secret.
  resendApiKey: parsed.data.RESEND_API_KEY,
  smtpHost: parsed.data.SMTP_HOST,
  smtpPort: parsed.data.SMTP_PORT,
  smtpUser: parsed.data.SMTP_USER,
  // Never log this value — server-only secret.
  smtpPass: parsed.data.SMTP_PASS,
  smtpSecure: parsed.data.SMTP_SECURE,
  emailFrom: parsed.data.EMAIL_FROM,
  dashboardUrl: parsed.data.DASHBOARD_URL.replace(/\/+$/, ""),
  sentryDsn: parsed.data.SENTRY_DSN,
  requireEmailVerification: parsed.data.REQUIRE_EMAIL_VERIFICATION,
  seedDemoAccount: parsed.data.SEED_DEMO_ACCOUNT,
  googleClientId: parsed.data.GOOGLE_CLIENT_ID,
  // Never log this value — server-only secret.
  googleClientSecret: parsed.data.GOOGLE_CLIENT_SECRET,
  googleRedirectUri: parsed.data.GOOGLE_REDIRECT_URI,
};
