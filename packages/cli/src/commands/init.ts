import { Command } from "commander";

import { buildDefaultConfig, writeConfig } from "../services/config.service.js";
import { log } from "../utils/logger.js";
import { configExists, getProjectRoot, isReactNativeProject } from "../utils/paths.js";

interface InitOptions {
  serverUrl: string;
}

async function runInit(options: InitOptions): Promise<void> {
  const root = getProjectRoot();

  if (!isReactNativeProject(root)) {
    log.warn("This does not look like a React Native project (react-native not found in package.json).");
  }

  if (await configExists(root)) {
    log.error("openota.config.json already exists in this project.");
    process.exitCode = 1;
    return;
  }

  const config = buildDefaultConfig(options.serverUrl);
  await writeConfig(root, config);

  log.success("Created openota.config.json");
  log.info(`Server URL: ${config.serverUrl}`);
  log.info(`Platforms: ${config.platforms.join(", ")}`);
}

export function registerInitCommand(program: Command): void {
  program
    .command("init")
    .description("Initialize OpenOTA inside a React Native project")
    .option("--server-url <url>", "OpenOTA server URL", "http://localhost:3001/api/v1")
    .action(async (options: InitOptions) => {
      await runInit(options);
    });
}
