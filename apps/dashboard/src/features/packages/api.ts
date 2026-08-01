import type { CheckResponse, Manifest, PackageMetadata, Platform } from "@openota/shared";

import { apiRequest, downloadUrl } from "@/lib/api-client";

/**
 * Every function here takes an explicit `projectId` and calls the project-scoped routes
 * (`/projects/:id/packages/...`) — authenticated by the dashboard's own session cookie via
 * requireApiKey's session fallback (see apiKey.middleware.ts), the same way `/projects` and
 * `/api-keys` already are. There is deliberately no "legacy flat route" fallback here: once a
 * project exists, package management always goes through it, so releases are never accidentally
 * written to the old global/flat namespace from the dashboard.
 */
function basePath(projectId: string): string {
  return `/projects/${projectId}/packages`;
}

export function listPackages(projectId: string): Promise<PackageMetadata[]> {
  return apiRequest<PackageMetadata[]>(basePath(projectId));
}

export function getPackage(projectId: string, platform: Platform, version: string): Promise<PackageMetadata> {
  return apiRequest<PackageMetadata>(`${basePath(projectId)}/${platform}/${version}`);
}

export function deletePackage(projectId: string, platform: Platform, version: string): Promise<{ deleted: boolean }> {
  return apiRequest(`${basePath(projectId)}/${platform}/${version}`, { method: "DELETE" });
}

export function rollbackPackage(
  projectId: string,
  platform: Platform,
  version: string,
  options?: { channel?: string; reason?: string },
): Promise<Manifest> {
  return apiRequest<Manifest>(`${basePath(projectId)}/rollback`, {
    method: "POST",
    body: { platform, version, channel: options?.channel, reason: options?.reason },
  });
}

export function checkForUpdate(projectId: string, platform: Platform, currentVersion: string): Promise<CheckResponse> {
  return apiRequest<CheckResponse>(`${basePath(projectId)}/check`, { query: { platform, currentVersion } });
}

export function getPackageDownloadUrl(projectId: string, platform: Platform, version: string): string {
  return downloadUrl(`${basePath(projectId)}/${platform}/${version}/download`);
}
