import { PACKAGES_ENDPOINT, ROLLBACK_ENDPOINT } from "../constants/index.js";
import type { OpenOtaConfig } from "../types/index.js";

/**
 * Every release-affecting request must target the project-scoped routes
 * (`/projects/{projectId}/packages/...`) when `config.projectId` is set — the flat `/packages`
 * routes are a *different*, unisolated namespace, and hitting them with a project API key
 * silently authenticates (the key is still valid) while writing the release into the wrong place.
 * Only genuinely project-less setups (self-hosted, single shared `OPENOTA_API_KEY`, no dashboard)
 * fall back to the flat routes.
 */
export function packagesEndpoint(config: OpenOtaConfig): string {
  return config.projectId ? `/projects/${config.projectId}/packages` : PACKAGES_ENDPOINT;
}

export function rollbackEndpoint(config: OpenOtaConfig): string {
  return config.projectId ? `/projects/${config.projectId}/packages/rollback` : ROLLBACK_ENDPOINT;
}
