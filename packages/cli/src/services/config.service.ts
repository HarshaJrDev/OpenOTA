import fse from "fs-extra";
import { z } from "zod";

import { DEFAULT_BUNDLE_OUTPUT, DEFAULT_DEPLOYMENT, SUPPORTED_PLATFORMS } from "../constants/index.js";
import type { OpenOtaConfig } from "../types/index.js";
import { getConfigPath } from "../utils/paths.js";

// Mirrors the OpenOTA server's own validator.ts semverSchema exactly (`^\d+\.\d+\.\d+$`) — the
// server rejects anything else with a 400 at upload time, so the CLI checks this locally to fail
// fast with a clear, actionable message instead of a late, confusing network error.
export const RUNTIME_VERSION_PATTERN = /^\d+\.\d+\.\d+$/;

const configSchema = z.object({
  serverUrl: z.string().url("serverUrl must be a valid URL"),
  deployment: z.string().min(1).default(DEFAULT_DEPLOYMENT),
  platforms: z.array(z.enum(SUPPORTED_PLATFORMS)).min(1),
  bundleOutput: z.string().min(1).default(DEFAULT_BUNDLE_OUTPUT),
  // Deprecated: `login` used to write the API key here. Still accepted (never rejected) so an
  // old openota.config.json doesn't hard-break, but no command reads this for auth anymore — see
  // credentials.service.ts. `doctor` warns if this is still present so it gets cleaned up.
  apiKey: z.string().optional(),
  // Required, not defaulted: silently inventing a runtimeVersion (e.g. from package.json) is
  // exactly the footgun this field exists to prevent — see MissingRuntimeVersionError and
  // InvalidRuntimeVersionFormatError below for the dedicated, actionable errors this produces.
  runtimeVersion: z.string().min(1),
});

export class ConfigNotFoundError extends Error {
  constructor() {
    super("openota.config.json not found. Run `openota init` first.");
    this.name = "ConfigNotFoundError";
  }
}

export class ConfigValidationError extends Error {
  constructor(details: string) {
    super(`Invalid openota.config.json: ${details}`);
    this.name = "ConfigValidationError";
  }
}

/** Dedicated, actionable error for the single most consequential missing field: without it, every OTA bundle this CLI builds would silently fail native runtime verification. */
export class MissingRuntimeVersionError extends Error {
  constructor() {
    super(
      [
        "OpenOTA configuration error:",
        '"runtimeVersion" is required.',
        "",
        "Add it to openota.config.json:",
        "",
        "{",
        '  "runtimeVersion": "1.0.0"',
        "}",
        "",
        "This must exactly match the value your Android host app passes to",
        "BundleLoader.getJSBundleFile(context, runtimeVersion) in MainApplication.kt.",
      ].join("\n"),
    );
    this.name = "MissingRuntimeVersionError";
  }
}

/** Mirrors the OpenOTA server's own rejection message so a build never has to reach the network to discover this. */
export class InvalidRuntimeVersionFormatError extends Error {
  constructor(value: string) {
    super(
      [
        "OpenOTA configuration error:",
        `"runtimeVersion" (${JSON.stringify(value)}) must follow semantic versioning (e.g. 1.0.0).`,
        "",
        "Update openota.config.json:",
        "",
        "{",
        '  "runtimeVersion": "1.0.0"',
        "}",
      ].join("\n"),
    );
    this.name = "InvalidRuntimeVersionFormatError";
  }
}

export function buildDefaultConfig(serverUrl: string, runtimeVersion: string): OpenOtaConfig {
  return {
    serverUrl,
    deployment: DEFAULT_DEPLOYMENT,
    platforms: ["android", "ios"],
    bundleOutput: DEFAULT_BUNDLE_OUTPUT,
    runtimeVersion,
  };
}

export async function writeConfig(root: string, config: OpenOtaConfig): Promise<void> {
  await fse.writeJson(getConfigPath(root), config, { spaces: 2 });
}

export async function loadConfig(root: string = process.cwd()): Promise<OpenOtaConfig> {
  const configPath = getConfigPath(root);

  if (!(await fse.pathExists(configPath))) {
    throw new ConfigNotFoundError();
  }

  const raw: unknown = await fse.readJson(configPath);
  const result = configSchema.safeParse(raw);

  if (!result.success) {
    const runtimeVersionOnly =
      result.error.issues.length === 1 && result.error.issues[0]?.path.join(".") === "runtimeVersion";

    if (runtimeVersionOnly) {
      throw new MissingRuntimeVersionError();
    }

    throw new ConfigValidationError(result.error.issues.map((issue) => issue.message).join(", "));
  }

  if (!RUNTIME_VERSION_PATTERN.test(result.data.runtimeVersion)) {
    throw new InvalidRuntimeVersionFormatError(result.data.runtimeVersion);
  }

  // Lets a build/release/rollback target a different server (Railway, Render, a local instance)
  // without editing the committed openota.config.json — e.g. switching deployments, or CI running
  // against a staging backend. Still validated as a URL so a typo fails fast, not mid-upload.
  const serverUrlOverride = process.env.OPENOTA_SERVER_URL;
  if (serverUrlOverride) {
    const parsed = z.string().url("OPENOTA_SERVER_URL must be a valid URL").safeParse(serverUrlOverride);
    if (!parsed.success) {
      throw new ConfigValidationError(parsed.error.issues.map((issue) => issue.message).join(", "));
    }
    return { ...result.data, serverUrl: parsed.data };
  }

  return result.data;
}
