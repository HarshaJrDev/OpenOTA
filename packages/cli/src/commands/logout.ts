import { Command } from "commander";

import { loadConfig } from "../services/config.service.js";
import { removeApiKey } from "../services/credentials.service.js";
import { log } from "../utils/logger.js";
import { getProjectRoot } from "../utils/paths.js";

export async function runLogout(): Promise<void> {
  const root = getProjectRoot();
  const config = await loadConfig(root);

  await removeApiKey(config.serverUrl);
  log.success(`Logged out. API key removed for ${config.serverUrl}.`);
}

export function registerLogoutCommand(program: Command): void {
  program
    .command("logout")
    .description("Remove the stored OpenOTA API key")
    .action(async () => {
      try {
        await runLogout();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown logout error";
        log.error(`Logout failed: ${message}`);
        process.exitCode = 1;
      }
    });
}
