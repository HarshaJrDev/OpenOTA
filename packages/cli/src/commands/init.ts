import { Command } from "commander";

import { SDK_NATIVE_DEPS } from "../constants/index.js";
import { buildDefaultConfig, RUNTIME_VERSION_PATTERN, writeConfig } from "../services/config.service.js";
import { getMissingDeps, installDependencies } from "../services/dependencies.service.js";
import { log, startSpinner, succeed, fail } from "../utils/logger.js";
import { configExists, getProjectRoot, isReactNativeProject } from "../utils/paths.js";
import { detectPackageManager } from "../utils/package-manager.js";
import { detectAndroidVersionName } from "../utils/version.js";

// The two packages a project actually imports from (@openota/sdk in JS, @openota/native-android
// via autolinking) — distinct from SDK_NATIVE_DEPS, which are @openota/sdk's own native peer deps.
// Both groups need to land in package.json for the app to work, so init installs both in one pass.
const OPENOTA_PACKAGES = ["@openota/sdk", "@openota/native-android"];

interface InitOptions {
  serverUrl: string;
  runtimeVersion?: string;
  projectId?: string;
  skipInstall?: boolean;
}

async function installMissingDependencies(root: string): Promise<void> {
  const missing = await getMissingDeps(root, [...OPENOTA_PACKAGES, ...SDK_NATIVE_DEPS]);
  if (missing.length === 0) {
    return;
  }

  const pm = detectPackageManager(root);
  const spinner = startSpinner(`Installing dependencies with ${pm} (${missing.join(", ")})...`);
  try {
    await installDependencies(root, missing);
    succeed(spinner, `Installed: ${missing.join(", ")}`);
  } catch (error) {
    fail(spinner, `Could not install dependencies automatically (${error instanceof Error ? error.message : "unknown error"})`);
    log.info(`Install them yourself: ${pm} ${pm === "npm" ? "install" : "add"} ${missing.join(" ")}`);
  }
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

  let runtimeVersion = options.runtimeVersion;
  let detected = false;

  if (!runtimeVersion) {
    const suggestion = detectAndroidVersionName(root);
    // Android's versionName is often a short form like "1.0", not valid semver ("1.0.0") — the
    // OpenOTA server rejects anything else, so an unusable suggestion is treated the same as no
    // suggestion at all rather than silently written into the config.
    if (suggestion && RUNTIME_VERSION_PATTERN.test(suggestion)) {
      runtimeVersion = suggestion;
      detected = true;
    } else if (suggestion) {
      log.warn(
        `Detected Android versionName "${suggestion}", but it isn't valid semantic versioning ` +
          '(e.g. "1.0.0") — the OpenOTA server requires that format, so it was not used automatically.',
      );
    }
  }

  if (!runtimeVersion) {
    log.error(
      [
        "Could not determine a runtimeVersion.",
        "Pass one explicitly: openota init --runtime-version 1.0.0",
        "(Android's android/app/build.gradle versionName is used as a suggestion when it's already valid semver.)",
      ].join("\n"),
    );
    process.exitCode = 1;
    return;
  }

  if (!RUNTIME_VERSION_PATTERN.test(runtimeVersion)) {
    log.error(
      `"runtimeVersion" (${JSON.stringify(runtimeVersion)}) must follow semantic versioning (e.g. 1.0.0).`,
    );
    process.exitCode = 1;
    return;
  }

  const config = buildDefaultConfig(options.serverUrl, runtimeVersion);
  if (options.projectId) {
    config.projectId = options.projectId;
  }
  await writeConfig(root, config);

  if (!options.skipInstall) {
    await installMissingDependencies(root);
  }

  log.success("Created openota.config.json");
  log.info(`Server URL: ${config.serverUrl}`);
  log.info(`Platforms: ${config.platforms.join(", ")}`);
  if (config.projectId) {
    log.info(`Project ID: ${config.projectId}`);
  } else {
    log.info("No --project-id given — this targets a self-hosted server's flat namespace. For OpenOTA " +
      "Cloud, run `openota login --api-key <key>` next; it resolves and fills in the project automatically.");
  }
  log.info(
    `Runtime version: ${config.runtimeVersion}${detected ? " (detected from android/app/build.gradle versionName — review this)" : ""}`,
  );

  if (detected) {
    log.warn(
      "runtimeVersion was auto-suggested from Android's versionName. This is only a starting point — " +
        "it does not stay in sync automatically. Review packages/native-android's README for the " +
        "MainApplication.kt integration this value must match.",
    );
  }

  log.title("Next steps");
  log.info("1. openota login --api-key <key>   (OpenOTA Cloud) or skip for self-hosted");
  log.info("2. openota doctor                  verify native wiring (Android/iOS)");
  log.info("3. openota release --version <x.y.z> --platform android");
}

export function registerInitCommand(program: Command): void {
  program
    .command("init")
    .description("Initialize OpenOTA inside a React Native project")
    .option("--server-url <url>", "OpenOTA server URL", "http://localhost:3001/api/v1")
    .option(
      "--runtime-version <version>",
      "Native binary compatibility identifier (defaults to Android's versionName if detected)",
    )
    .option(
      "--project-id <id>",
      "OpenOTA Cloud project ID (omit for self-hosted; `openota login` fills this in automatically)",
    )
    .option("--skip-install", "Don't auto-install missing @openota/sdk native dependencies", false)
    .action(async (options: InitOptions) => {
      await runInit(options);
    });
}
