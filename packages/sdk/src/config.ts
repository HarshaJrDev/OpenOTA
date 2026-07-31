import { DEFAULT_AUTO_RESTART, DEFAULT_CHANNEL, DEFAULT_REQUEST_TIMEOUT_MS } from "@openota/shared";

import { OTAError } from "./errors.js";
import type { OtaConfig, OtaConfigInput } from "./types.js";

let currentConfig: OtaConfig | null = null;

function normalizeServerUrl(serverUrl: string): string {
  if (!/^https?:\/\//.test(serverUrl)) {
    throw new OTAError("NOT_CONFIGURED", `serverUrl must be an absolute http(s) URL, got "${serverUrl}"`);
  }

  return serverUrl.replace(/\/+$/, "");
}

export function configure(input: OtaConfigInput): OtaConfig {
  const config: OtaConfig = {
    serverUrl: normalizeServerUrl(input.serverUrl),
    channel: input.channel ?? DEFAULT_CHANNEL,
    autoRestart: input.autoRestart ?? DEFAULT_AUTO_RESTART,
    requestTimeout: input.requestTimeout ?? DEFAULT_REQUEST_TIMEOUT_MS,
    headers: input.headers,
    projectId: input.projectId,
  };

  currentConfig = config;
  return config;
}

export function getConfig(): OtaConfig {
  if (!currentConfig) {
    throw new OTAError("NOT_CONFIGURED", "OTA.configure() must be called before using the SDK");
  }

  return currentConfig;
}

export function resetConfig(): void {
  currentConfig = null;
}
