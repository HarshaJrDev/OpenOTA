import { Command } from "commander";

import { describeApiError } from "../utils/api-error.js";
import { createApiClient } from "../services/api.service.js";
import { loadConfig } from "../services/config.service.js";
import { getApiKey } from "../services/credentials.service.js";
import { packagesEndpoint } from "../services/endpoints.js";
import { uploadPackage } from "../services/upload.service.js";
import { fail, log, startSpinner, succeed } from "../utils/logger.js";
import { getProjectRoot } from "../utils/paths.js";
import { runBuild } from "./build.js";

interface ReleaseCommandOptions {
  version: string;
  platform?: string;
  dev?: boolean;
  channel?: string;
  releaseNotes?: string;
}

export async function runRelease(options: ReleaseCommandOptions): Promise<void> {
  const root = getProjectRoot();
  const buildResults = await runBuild(options);
  const config = await loadConfig(root);
  const apiKey = await getApiKey(config.serverUrl);

  // Fail fast with an actionable message instead of letting every platform's upload attempt (and
  // fail identically) against a client with no Authorization header at all.
  if (!apiKey) {
    throw new Error(`Not logged in for ${config.serverUrl}. Run \`openota login --api-key <key>\` first.`);
  }

  const client = createApiClient(config, apiKey);

  for (const result of buildResults) {
    const spinner = startSpinner(`Uploading ${result.platform} package (0%)...`);

    try {
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
          channel: options.channel ?? config.channel,
          releaseNotes: options.releaseNotes,
        },
        (percent) => {
          spinner.text = `Uploading ${result.platform} package (${percent}%)...`;
        },
      );

      succeed(spinner, `${result.platform} uploaded: ${uploaded.downloadUrl}`);
    } catch (error) {
      // A stuck spinner (e.g. "Uploading android package (100%)..." forever) is exactly what
      // happened before this fix — uploadPackage throwing mid-request left `spinner` running with
      // no terminal state at all. This must always resolve one way or the other before the error
      // propagates, on every failure path, not just a subset.
      fail(spinner, `${result.platform} upload failed: ${describeApiError(error)}`);
      throw new Error(describeApiError(error));
    }
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
    .option("--channel <channel>", "Release channel (defaults to config's channel, or \"production\")")
    .option("--release-notes <notes>", "Changelog for this release, shown on the dashboard")
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
