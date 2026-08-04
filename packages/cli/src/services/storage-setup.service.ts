import path from "node:path";

import axios from "axios";
import fse from "fs-extra";

const ENV_FILENAME = ".env";

export interface LocalStorageConfig {
  provider: "local";
  storageRoot: string;
}

export interface SupabaseStorageConfig {
  provider: "supabase";
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  supabaseStorageBucket: string;
}

export type StorageConfig = LocalStorageConfig | SupabaseStorageConfig;

/**
 * Only these two — matches what apps/server/src/providers/storage actually implements today
 * (local disk + Supabase). No S3/R2/Firebase/MinIO provider exists server-side, so wizarding
 * through credentials for them here would generate a `.env` the server can't actually use.
 */
const ENV_KEYS: Record<StorageConfig["provider"], string[]> = {
  local: ["STORAGE_PROVIDER", "STORAGE_ROOT"],
  supabase: ["STORAGE_PROVIDER", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_STORAGE_BUCKET"],
};

function toEnvLines(config: StorageConfig): string[] {
  if (config.provider === "local") {
    return [`STORAGE_PROVIDER=local`, `STORAGE_ROOT=${config.storageRoot}`];
  }
  return [
    `STORAGE_PROVIDER=supabase`,
    `SUPABASE_URL=${config.supabaseUrl}`,
    `SUPABASE_SERVICE_ROLE_KEY=${config.supabaseServiceRoleKey}`,
    `SUPABASE_STORAGE_BUCKET=${config.supabaseStorageBucket}`,
  ];
}

/**
 * Replaces (or appends) just the storage-related keys in an existing `.env`, leaving every other
 * line — DATABASE_URL, SESSION_SECRET, unrelated comments — completely untouched. A self-hosted
 * operator's `.env` almost always has other real secrets in it by the time they run this; blowing
 * the whole file away would be exactly the kind of destructive shortcut worth avoiding.
 */
export async function writeStorageEnv(root: string, config: StorageConfig): Promise<string> {
  const envPath = path.join(root, ENV_FILENAME);
  const existing = (await fse.pathExists(envPath)) ? await fse.readFile(envPath, "utf-8") : "";
  const existingLines = existing.length > 0 ? existing.split("\n") : [];

  const keysToReplace = new Set([...ENV_KEYS.local, ...ENV_KEYS.supabase]);
  const kept = existingLines.filter((line) => {
    const key = line.split("=")[0]?.trim();
    return !(key && keysToReplace.has(key));
  });

  const newLines = toEnvLines(config);
  const merged = [...kept.filter((line) => line.trim().length > 0), "", "# --- Storage (openota storage setup) ---", ...newLines];

  await fse.writeFile(envPath, merged.join("\n") + "\n", "utf-8");
  return envPath;
}

export interface StorageValidationResult {
  ok: boolean;
  checks: Array<{ name: string; ok: boolean; message: string }>;
}

async function validateLocal(config: LocalStorageConfig, root: string): Promise<StorageValidationResult> {
  const checks: StorageValidationResult["checks"] = [];
  const resolved = path.resolve(root, config.storageRoot);

  try {
    await fse.ensureDir(resolved);
    checks.push({ name: "Directory exists", ok: true, message: resolved });
  } catch (error) {
    checks.push({
      name: "Directory exists",
      ok: false,
      message: error instanceof Error ? error.message : "could not create directory",
    });
    return { ok: false, checks };
  }

  const probeFile = path.join(resolved, ".openota-storage-probe");
  try {
    await fse.writeFile(probeFile, "ok");
    await fse.remove(probeFile);
    checks.push({ name: "Write permission", ok: true, message: "wrote and deleted a probe file" });
  } catch (error) {
    checks.push({
      name: "Write permission",
      ok: false,
      message: error instanceof Error ? error.message : "write failed",
    });
  }

  return { ok: checks.every((c) => c.ok), checks };
}

async function validateSupabase(config: SupabaseStorageConfig): Promise<StorageValidationResult> {
  const checks: StorageValidationResult["checks"] = [];
  const headers = {
    apikey: config.supabaseServiceRoleKey,
    Authorization: `Bearer ${config.supabaseServiceRoleKey}`,
  };

  try {
    await axios.get(`${config.supabaseUrl}/storage/v1/bucket/${config.supabaseStorageBucket}`, {
      headers,
      timeout: 10_000,
    });
    checks.push({ name: "Connect + bucket check", ok: true, message: `bucket "${config.supabaseStorageBucket}" reachable` });
  } catch (error) {
    const status = axios.isAxiosError(error) ? error.response?.status : undefined;
    const message =
      status === 404
        ? `bucket "${config.supabaseStorageBucket}" does not exist — create it in the Supabase dashboard first`
        : status === 401 || status === 403
          ? "authentication failed — check SUPABASE_SERVICE_ROLE_KEY"
          : error instanceof Error
            ? error.message
            : "unreachable";
    checks.push({ name: "Connect + bucket check", ok: false, message });
    return { ok: false, checks };
  }

  const probeKey = `.openota-storage-probe-${Date.now()}`;
  try {
    await axios.post(
      `${config.supabaseUrl}/storage/v1/object/${config.supabaseStorageBucket}/${probeKey}`,
      "ok",
      { headers: { ...headers, "Content-Type": "text/plain" }, timeout: 10_000 },
    );
    checks.push({ name: "Upload test", ok: true, message: "wrote a probe object" });

    await axios.delete(`${config.supabaseUrl}/storage/v1/object/${config.supabaseStorageBucket}/${probeKey}`, {
      headers,
      timeout: 10_000,
    });
    checks.push({ name: "Delete test", ok: true, message: "deleted the probe object" });
  } catch (error) {
    checks.push({
      name: "Upload/delete test",
      ok: false,
      message: error instanceof Error ? error.message : "upload or delete failed",
    });
  }

  return { ok: checks.every((c) => c.ok), checks };
}

export async function validateStorage(config: StorageConfig, root: string): Promise<StorageValidationResult> {
  return config.provider === "local" ? validateLocal(config, root) : validateSupabase(config);
}
