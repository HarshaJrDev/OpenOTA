import { CHECK_ENDPOINT, isPlatform, isValidSha256, type Manifest } from "@openota/shared";

import { apiGet } from "../client.js";
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

export async function checkForUpdate(platform: Platform, currentVersion: string): Promise<CheckResult> {
  const data = await apiGet<unknown>(CHECK_ENDPOINT, { platform, currentVersion });
  assertValidCheckResult(data);
  return data;
}
