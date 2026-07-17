import { Command } from "commander";

import { loadConfig, writeConfig } from "../services/config.service.js";
import { log } from "../utils/logger.js";
import { getProjectRoot } from "../utils/paths.js";

export async function runLogout(): Promise<void> {
  const root = getProjectRoot();
  const config = await loadConfig(root);
  const { apiKey: _apiKey, ...rest } = config;

  await writeConfig(root, rest);
  log.success("Logged out. API key removed from openota.config.json");
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
