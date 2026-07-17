import path from "node:path";

import { MANIFEST_FILENAME, parseManifest } from "@openota/shared";
import { Command } from "commander";
import fse from "fs-extra";

import { createApiClient } from "../services/api.service.js";
import { loadConfig } from "../services/config.service.js";
import { uploadPackage } from "../services/upload.service.js";
import type { Platform } from "../types/index.js";
import { log, startSpinner, succeed } from "../utils/logger.js";
import { getProjectRoot } from "../utils/paths.js";

interface UploadCommandOptions {
  zip: string;
  platform: Platform;
  version: string;
}

export async function runUpload(options: UploadCommandOptions): Promise<void> {
  const root = getProjectRoot();
  const config = await loadConfig(root);
  const client = createApiClient(config);

  // The manifest built alongside the zip (by `openota build`) is the authoritative source for
  // runtimeVersion/bundleName — recomputing them here risks drifting from what was actually
  // packaged if the CLI is invoked from a different checkout state than the build was.
  const zipPath = path.resolve(root, options.zip);
  const manifestPath = path.join(path.dirname(zipPath), MANIFEST_FILENAME);
  const manifest = parseManifest(await fse.readJson(manifestPath));

  const spinner = startSpinner("Uploading package (0%)...");

  const uploaded = await uploadPackage(
    client,
    {
      zipPath,
      platform: options.platform,
      version: options.version,
      runtimeVersion: manifest.runtimeVersion,
      bundleName: manifest.bundleName,
      sha256: manifest.sha256,
      size: manifest.size,
    },
    (percent) => {
      spinner.text = `Uploading package (${percent}%)...`;
    },
  );

  succeed(spinner, `Uploaded successfully: ${uploaded.downloadUrl}`);
}

export function registerUploadCommand(program: Command): void {
  program
    .command("upload")
    .description("Upload an OTA package to the OpenOTA server")
    .requiredOption("--zip <path>", "Path to ota-package.zip")
    .requiredOption("--platform <platform>", "Platform (android|ios)")
    .requiredOption("--version <version>", "Version of the package")
    .action(async (options: UploadCommandOptions) => {
      try {
        await runUpload(options);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown upload error";
        log.error(`Upload failed: ${message}`);
        process.exitCode = 1;
      }
    });
}
