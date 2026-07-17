import axios, { type AxiosInstance } from "axios";

import type { OpenOtaConfig } from "../types/index.js";

export function createApiClient(config: OpenOtaConfig): AxiosInstance {
  return axios.create({
    baseURL: config.serverUrl,
    headers: config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : undefined,
  });
}
