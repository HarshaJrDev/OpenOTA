import { Command } from "commander";

import { log, startSpinner, succeed, fail } from "../utils/logger.js";
import { getProjectRoot } from "../utils/paths.js";
import {
  validateStorage,
  writeStorageEnv,
  type StorageConfig,
} from "../services/storage-setup.service.js";

interface StorageOptions {
  provider: "local" | "supabase";
  storageRoot?: string;
  supabaseUrl?: string;
  supabaseKey?: string;
  supabaseBucket?: string;
}

/** Self-hosting only — this writes/validates the *server's* `.env`, unlike every other command here which targets a React Native app checkout. Run from your apps/server (or server deployment) directory. */
function buildConfig(options: StorageOptions): StorageConfig {
  if (options.provider === "local") {
    return { provider: "local", storageRoot: options.storageRoot ?? "./storage" };
  }

  const missing = ["supabaseUrl", "supabaseKey", "supabaseBucket"].filter(
    (key) => !options[key as keyof StorageOptions],
  );
  if (missing.length > 0) {
    throw new Error(
      `--provider supabase requires --supabase-url, --supabase-key, and --supabase-bucket (missing: ${missing.join(", ")})`,
    );
  }

  return {
    provider: "supabase",
    supabaseUrl: options.supabaseUrl!,
    supabaseServiceRoleKey: options.supabaseKey!,
    supabaseStorageBucket: options.supabaseBucket!,
  };
}

function printChecks(result: { ok: boolean; checks: Array<{ name: string; ok: boolean; message: string }> }): void {
  for (const check of result.checks) {
    if (check.ok) {
      log.success(`${check.name}: ${check.message}`);
    } else {
      log.error(`${check.name}: ${check.message}`);
    }
  }
}

async function runSetup(options: StorageOptions): Promise<void> {
  const root = getProjectRoot();
  let config: StorageConfig;
  try {
    config = buildConfig(options);
  } catch (error) {
    log.error(error instanceof Error ? error.message : "invalid options");
    process.exitCode = 1;
    return;
  }

  const spinner = startSpinner(`Validating ${config.provider} storage before writing .env...`);
  const result = await validateStorage(config, root);

  if (!result.ok) {
    fail(spinner, "Validation failed — .env was not changed");
    printChecks(result);
    process.exitCode = 1;
    return;
  }
  succeed(spinner, "Validated");
  printChecks(result);

  const envPath = await writeStorageEnv(root, config);
  log.success(`Wrote storage configuration to ${envPath}`);
  log.info("Restart your server for the new settings to take effect.");
}

async function runValidate(options: StorageOptions): Promise<void> {
  const root = getProjectRoot();
  let config: StorageConfig;
  try {
    config = buildConfig(options);
  } catch (error) {
    log.error(error instanceof Error ? error.message : "invalid options");
    process.exitCode = 1;
    return;
  }

  log.title(`Validating ${config.provider} storage`);
  const result = await validateStorage(config, root);
  printChecks(result);

  if (result.ok) {
    log.success("Ready.");
  } else {
    process.exitCode = 1;
  }
}

export function registerStorageCommand(program: Command): void {
  const storage = program.command("storage").description("Configure and validate this server's storage backend (self-hosted)");

  storage
    .command("setup")
    .description("Validate storage credentials, then write them to .env (only replaces storage-related keys)")
    .requiredOption("--provider <provider>", "local or supabase")
    .option("--storage-root <path>", "Directory for local storage", "./storage")
    .option("--supabase-url <url>", "Supabase project URL")
    .option("--supabase-key <key>", "Supabase service role key")
    .option("--supabase-bucket <bucket>", "Supabase Storage bucket name")
    .action(async (options: StorageOptions) => {
      await runSetup(options);
    });

  storage
    .command("validate")
    .description("Check that a storage backend is reachable — connect, bucket check, upload/delete test")
    .requiredOption("--provider <provider>", "local or supabase")
    .option("--storage-root <path>", "Directory for local storage", "./storage")
    .option("--supabase-url <url>", "Supabase project URL")
    .option("--supabase-key <key>", "Supabase service role key")
    .option("--supabase-bucket <bucket>", "Supabase Storage bucket name")
    .action(async (options: StorageOptions) => {
      await runValidate(options);
    });
}
