import { Command } from "commander";

import { createApiClient } from "../services/api.service.js";
import { loadConfig } from "../services/config.service.js";
import { getApiKey } from "../services/credentials.service.js";
import { packagesEndpoint } from "../services/endpoints.js";
import { uploadPackage } from "../services/upload.service.js";
import { log, startSpinner, succeed } from "../utils/logger.js";
import { getProjectRoot } from "../utils/paths.js";
import { runBuild } from "./build.js";

interface ReleaseCommandOptions {
  version: string;
  platform?: string;
  dev?: boolean;
}

export async function runRelease(options: ReleaseCommandOptions): Promise<void> {
  const root = getProjectRoot();
  const buildResults = await runBuild(options);
  const config = await loadConfig(root);
  const apiKey = await getApiKey(config.serverUrl);
  const client = createApiClient(config, apiKey);

  for (const result of buildResults) {
    const spinner = startSpinner(`Uploading ${result.platform} package (0%)...`);

    const uploaded = await uploadPackage(
      client,
      packagesEndpoint(config),
      {
        zipPath: result.zipPath,
        platform: result.platform,
        version: result.version,
        runtimeVersion: result.manifest.runtimeVersion,
        bundleName: result.manifest.bundleName,
        sha256: result.manifest.sha256,
        size: result.manifest.size,
      },
      (percent) => {
        spinner.text = `Uploading ${result.platform} package (${percent}%)...`;
      },
    );

    succeed(spinner, `${result.platform} uploaded: ${uploaded.downloadUrl}`);
  }

  log.title("Release complete");
}

export function registerReleaseCommand(program: Command): void {
  program
    .command("release")
    .description("Build and upload an OTA package in one step")
    .requiredOption("--version <version>", "Version of the OTA package")
    .option("--platform <platform>", "Release a single platform (android|ios)")
    .option("--dev", "Build a development (unminified) bundle", false)
    .action(async (options: ReleaseCommandOptions) => {
      try {
        await runRelease(options);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown release error";
        log.error(`Release failed: ${message}`);
        process.exitCode = 1;
      }
    });
}
