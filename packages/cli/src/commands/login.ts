import { Command } from "commander";

import { loadConfig } from "../services/config.service.js";
import { saveApiKey } from "../services/credentials.service.js";
import { log } from "../utils/logger.js";
import { getProjectRoot } from "../utils/paths.js";

interface LoginCommandOptions {
  apiKey: string;
}

export async function runLogin(options: LoginCommandOptions): Promise<void> {
  const root = getProjectRoot();
  const config = await loadConfig(root);

  // Written to the user-level credentials file, never to openota.config.json — that file lives
  // in the project repo and is meant to be committed. See credentials.service.ts's doc comment.
  await saveApiKey(config.serverUrl, options.apiKey);
  log.success(`Logged in. API key saved for ${config.serverUrl}.`);
}

export function registerLoginCommand(program: Command): void {
  program
    .command("login")
    .description("Authenticate the CLI with an OpenOTA API key")
    .requiredOption("--api-key <key>", "API key issued by the OpenOTA server")
    .action(async (options: LoginCommandOptions) => {
      try {
        await runLogin(options);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown login error";
        log.error(`Login failed: ${message}`);
        process.exitCode = 1;
      }
    });
}
