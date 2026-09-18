import { Command } from "commander";

import { createApiClient } from "../services/api.service.js";
import { loadConfig } from "../services/config.service.js";
import { getApiKey } from "../services/credentials.service.js";
import { rollbackEndpoint } from "../services/endpoints.js";
import type { Platform } from "../types/index.js";
import { describeApiError } from "../utils/api-error.js";
import { fail, log, startSpinner, succeed } from "../utils/logger.js";
import { getProjectRoot } from "../utils/paths.js";

interface RollbackCommandOptions {
  platform: Platform;
  version: string;
  channel?: string;
  reason?: string;
}

export async function runRollback(options: RollbackCommandOptions): Promise<void> {
  const root = getProjectRoot();
  const config = await loadConfig(root);
  const apiKey = await getApiKey(config.serverUrl);
  if (!apiKey) {
    throw new Error(`Not logged in for ${config.serverUrl}. Run \`openota login --api-key <key>\` first.`);
  }
  const client = createApiClient(config, apiKey);

  const spinner = startSpinner(`Rolling back ${options.platform} to v${options.version}...`);

  try {
    await client.post(rollbackEndpoint(config), {
      platform: options.platform,
      version: options.version,
      channel: options.channel ?? config.channel,
      reason: options.reason,
    });

    succeed(spinner, `Rolled back ${options.platform} to v${options.version}`);
  } catch (error) {
    fail(spinner, `Rollback failed: ${describeApiError(error)}`);
    throw new Error(describeApiError(error));
  }
}

export function registerRollbackCommand(program: Command): void {
  program
    .command("rollback")
    .description("Roll back the active deployment to a previous version")
    .requiredOption("--platform <platform>", "Platform (android|ios)")
    .requiredOption("--version <version>", "Version to roll back to")
    .option("--channel <channel>", "Release channel (defaults to config's channel, or \"production\")")
    .option("--reason <reason>", "Why this rollback happened, shown in deployment history")
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
