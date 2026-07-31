import { apiPost } from "../client.js";
import { getConfig } from "../config.js";
import { otaStorage } from "../storage.js";
import type { Platform } from "../types.js";

export type InstallResultStatus = "success" | "failure" | "rollback";

/**
 * Fire-and-forget: reporting an install outcome is telemetry, not core functionality, and must
 * never throw into the caller's install/rollback path (a flaky network shouldn't turn a
 * successful activation into a crash). Self-hosted/flat-route servers have nowhere to record
 * this (no project concept) — silently skipped rather than erroring, same posture as deviceId on
 * check/download.
 */
export function reportInstallResult(
  status: InstallResultStatus,
  platform: Platform,
  version: string,
  runtimeVersion: string,
): void {
  const projectId = getConfig().projectId;
  if (!projectId) {
    return;
  }

  void apiPost(`/projects/${projectId}/packages/report`, {
    deviceId: otaStorage.getOrCreateDeviceId(),
    platform,
    version,
    runtimeVersion,
    status,
  }).catch(() => undefined);
}
