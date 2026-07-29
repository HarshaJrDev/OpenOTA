import axios, { type AxiosInstance } from "axios";

import type { OpenOtaConfig } from "../types/index.js";

/** `apiKey` comes from credentials.service.ts (user-level file), never from `config.apiKey` — see that service's doc comment for why. */
export function createApiClient(config: OpenOtaConfig, apiKey?: string): AxiosInstance {
  return axios.create({
    baseURL: config.serverUrl,
    headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined,
  });
}
