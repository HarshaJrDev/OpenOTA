import { query } from "../../db/client.js";
import { env } from "../../config/env.js";
import { createStorageProvider } from "../../providers/storage/index.js";

// Constructed once per module load, same as app.ts's own top-level storageProvider — cheap
// (just picks which client to wrap based on env.storageProvider, holds no request-scoped state).
const storageProvider = createStorageProvider();

/**
 * Read-only status, deliberately — this is NOT a "save new credentials" surface. Database/storage/
 * email/domain config is bootstrap-level (set via env vars or docker-compose before the process
 * starts — see docs/CLOUD.md), not something the dashboard can hot-swap at runtime: a live DB
 * connection pool can't be safely re-pointed at a different database from a web request, and
 * neither self-hosted operators nor Cloud need that — self-hosted operators already control their
 * own env file, and Cloud's infra is ours to manage, not the customer's. What operators DO need is
 * visibility: which provider is active, is it actually reachable right now, and enough of the
 * config to recognize their own setup — never enough to reconstruct a working credential.
 */

function maskUrl(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    // host + path only — strips any embedded userinfo (user:pass@host), which a raw
    // DATABASE_URL commonly carries.
    return `${parsed.protocol}//${parsed.host}${parsed.pathname !== "/" ? parsed.pathname : ""}`;
  } catch {
    return "configured";
  }
}

export interface DatabaseStatus {
  provider: "postgres" | "embedded";
  connected: boolean;
  maskedUrl: string | null;
}

export async function getDatabaseStatus(): Promise<DatabaseStatus> {
  let connected = false;
  try {
    await query("SELECT 1");
    connected = true;
  } catch {
    connected = false;
  }
  return {
    provider: env.databaseUrl ? "postgres" : "embedded",
    connected,
    maskedUrl: env.databaseUrl ? maskUrl(env.databaseUrl) : "embedded (local, no external URL)",
  };
}

export interface StorageStatus {
  provider: "local" | "supabase";
  connected: boolean;
  maskedUrl: string | null;
  bucket: string | null;
}

export async function getStorageStatus(): Promise<StorageStatus> {
  let connected = false;
  try {
    await storageProvider.list("");
    connected = true;
  } catch {
    connected = false;
  }
  return {
    provider: env.storageProvider,
    connected,
    maskedUrl: env.storageProvider === "supabase" ? maskUrl(env.supabaseUrl) : env.storageRoot,
    bucket: env.storageProvider === "supabase" ? env.supabaseStorageBucket : null,
  };
}

export interface EmailStatus {
  transport: "resend" | "smtp" | "log-only";
  configured: boolean;
  maskedFrom: string;
  testMode: boolean;
}

export async function getEmailStatus(testMode: boolean): Promise<EmailStatus> {
  const transport = env.resendApiKey ? "resend" : env.smtpHost && env.smtpUser && env.smtpPass ? "smtp" : "log-only";
  return {
    transport,
    configured: transport !== "log-only",
    maskedFrom: env.emailFrom,
    testMode,
  };
}

export interface DomainStatus {
  dashboardUrl: string;
  corsAllowedOrigins: string[] | null;
  httpsEnforced: boolean;
}

export function getDomainStatus(): DomainStatus {
  return {
    dashboardUrl: env.dashboardUrl,
    corsAllowedOrigins: env.corsAllowedOrigins ?? null,
    httpsEnforced: env.dashboardUrl.startsWith("https://"),
  };
}
