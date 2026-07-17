import { Command } from "commander";

import { createOtaPackage } from "../services/archive.service.js";
import { verifyAssetsCollected } from "../services/assets.service.js";
import { loadConfig } from "../services/config.service.js";
import { buildManifest, buildMetadata } from "../services/manifest.service.js";
import { runMetroBundle } from "../services/metro.service.js";
import type { BuildResult, Platform } from "../types/index.js";
import { log, startSpinner, succeed } from "../utils/logger.js";
import { getProjectRoot, getVersionOutputDir } from "../utils/paths.js";

interface BuildCommandOptions {
  version: string;
  platform?: string;
  dev?: boolean;
}

export async function runBuild(options: BuildCommandOptions): Promise<BuildResult[]> {
  const root = getProjectRoot();
  const config = await loadConfig(root);

  const platforms: Platform[] = options.platform
    ? [options.platform as Platform]
    : config.platforms;

  const results: BuildResult[] = [];

  for (const platform of platforms) {
    log.title(`Building ${platform} package v${options.version}`);
    const outputDir = getVersionOutputDir(config.bundleOutput, platform, options.version, root);

    const bundleSpinner = startSpinner("Running Metro bundler...");
    const bundleResult = await runMetroBundle(root, outputDir, platform, options.dev);
    succeed(bundleSpinner, "Bundle created");

    const assetsSpinner = startSpinner("Collecting assets...");
    const assetCount = await verifyAssetsCollected(bundleResult.assetsDir);
    succeed(assetsSpinner, `Assets copied (${assetCount} files)`);

    const manifestSpinner = startSpinner("Generating manifest and SHA256...");
    const manifest = await buildManifest(outputDir, bundleResult, options.version, root);
    const metadata = await buildMetadata(outputDir, root);
    succeed(manifestSpinner, "Manifest generated");

    const zipSpinner = startSpinner("Archiving package...");
    const zipPath = await createOtaPackage(outputDir);
    succeed(zipSpinner, "Package archived");

    results.push({ platform, version: options.version, outputDir, zipPath, manifest, metadata });
  }

  return results;
}

export function registerBuildCommand(program: Command): void {
  program
    .command("build")
    .description("Build an OTA package (Metro bundle, assets, manifest, zip)")
    .requiredOption("--version <version>", "Version of the OTA package")
    .option("--platform <platform>", "Build a single platform (android|ios)")
    .option("--dev", "Build a development (unminified) bundle", false)
    .action(async (options: BuildCommandOptions) => {
      try {
        const results = await runBuild(options);

        for (const result of results) {
          log.success(`${result.platform}: ${result.zipPath}`);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown build error";
        log.error(`Build failed: ${message}`);
        process.exitCode = 1;
      }
    });
}
