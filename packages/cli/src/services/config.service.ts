import fse from "fs-extra";
import { z } from "zod";

import { DEFAULT_BUNDLE_OUTPUT, DEFAULT_DEPLOYMENT, SUPPORTED_PLATFORMS } from "../constants/index.js";
import type { OpenOtaConfig } from "../types/index.js";
import { getConfigPath } from "../utils/paths.js";

const configSchema = z.object({
  serverUrl: z.string().url("serverUrl must be a valid URL"),
  deployment: z.string().min(1).default(DEFAULT_DEPLOYMENT),
  platforms: z.array(z.enum(SUPPORTED_PLATFORMS)).min(1),
  bundleOutput: z.string().min(1).default(DEFAULT_BUNDLE_OUTPUT),
  apiKey: z.string().optional(),
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

export function buildDefaultConfig(serverUrl: string): OpenOtaConfig {
  return {
    serverUrl,
    deployment: DEFAULT_DEPLOYMENT,
    platforms: ["android", "ios"],
    bundleOutput: DEFAULT_BUNDLE_OUTPUT,
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
    throw new ConfigValidationError(result.error.issues.map((issue) => issue.message).join(", "));
  }

  return result.data;
}
