import { CHECK_ENDPOINT, isPlatform, isValidSha256, type Manifest } from "@openota/shared";

import { apiGet } from "../client.js";
import { getConfig } from "../config.js";
import { OTAError } from "../errors.js";
import type { CheckResult, Platform } from "../types.js";

function isValidManifest(value: unknown): value is Manifest {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const manifest = value as Record<string, unknown>;

  return (
    typeof manifest.manifestVersion === "number" &&
    typeof manifest.bundleVersion === "string" &&
    isPlatform(manifest.platform) &&
    typeof manifest.runtimeVersion === "string" &&
    typeof manifest.sha256 === "string" &&
    isValidSha256(manifest.sha256) &&
    typeof manifest.size === "number" &&
    typeof manifest.createdAt === "string" &&
    typeof manifest.bundleName === "string"
  );
}

function assertValidCheckResult(value: unknown): asserts value is CheckResult {
  if (typeof value !== "object" || value === null) {
    throw new OTAError("INVALID_MANIFEST", "Server returned a malformed check response");
  }

  const result = value as Record<string, unknown>;

  if (typeof result.available !== "boolean") {
    throw new OTAError("INVALID_MANIFEST", "Server response is missing 'available' flag");
  }

  if (result.manifest !== null && !isValidManifest(result.manifest)) {
    throw new OTAError("INVALID_MANIFEST", "Server returned an invalid manifest");
  }
}

/**
 * A project-scoped key (Cloud) writes releases into `/projects/{id}/packages/...` — an isolated
 * namespace, not the flat one. Without `projectId` configured, this device would keep checking the
 * flat `/packages/check` route and never see releases actually published to its own project (or
 * worse, on a shared multi-tenant server, could see a *different* project's release). See
 * OtaConfig.projectId's doc comment.
 */
function resolveCheckEndpoint(projectId: string | undefined): string {
  return projectId ? `/projects/${projectId}/packages/check` : CHECK_ENDPOINT;
}

export async function checkForUpdate(platform: Platform, currentVersion: string): Promise<CheckResult> {
  const endpoint = resolveCheckEndpoint(getConfig().projectId);
  const data = await apiGet<unknown>(endpoint, { platform, currentVersion });
  assertValidCheckResult(data);
  return data;
}
