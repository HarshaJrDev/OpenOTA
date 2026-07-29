import { Command } from "commander";

import { createApiClient } from "../services/api.service.js";
import { loadConfig } from "../services/config.service.js";
import { getApiKey } from "../services/credentials.service.js";
import { ROLLBACK_ENDPOINT } from "../constants/index.js";
import type { Platform } from "../types/index.js";
import { log, startSpinner, succeed } from "../utils/logger.js";
import { getProjectRoot } from "../utils/paths.js";

interface RollbackCommandOptions {
  platform: Platform;
  version: string;
}

export async function runRollback(options: RollbackCommandOptions): Promise<void> {
  const root = getProjectRoot();
  const config = await loadConfig(root);
  const apiKey = await getApiKey(config.serverUrl);
  const client = createApiClient(config, apiKey);

  const spinner = startSpinner(`Rolling back ${options.platform} to v${options.version}...`);

  await client.post(ROLLBACK_ENDPOINT, {
    platform: options.platform,
    version: options.version,
  });

  succeed(spinner, `Rolled back ${options.platform} to v${options.version}`);
}

export function registerRollbackCommand(program: Command): void {
  program
    .command("rollback")
    .description("Roll back the active deployment to a previous version")
    .requiredOption("--platform <platform>", "Platform (android|ios)")
    .requiredOption("--version <version>", "Version to roll back to")
    .action(async (options: RollbackCommandOptions) => {
      try {
        await runRollback(options);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown rollback error";
        log.error(`Rollback failed: ${message}`);
        process.exitCode = 1;
      }
    });
}
