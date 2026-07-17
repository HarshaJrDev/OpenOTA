import type { CheckResponse, Manifest, PackageMetadata, Platform } from "@openota/shared";

import { apiRequest, downloadUrl } from "@/lib/api-client";

export function listPackages(): Promise<PackageMetadata[]> {
  return apiRequest<PackageMetadata[]>("/packages");
}

export function getPackage(platform: Platform, version: string): Promise<PackageMetadata> {
  return apiRequest<PackageMetadata>(`/packages/${platform}/${version}`);
}

export function deletePackage(platform: Platform, version: string): Promise<{ deleted: boolean }> {
  return apiRequest(`/packages/${platform}/${version}`, { method: "DELETE" });
}

export function rollbackPackage(platform: Platform, version: string): Promise<Manifest> {
  return apiRequest<Manifest>("/packages/rollback", { method: "POST", body: { platform, version } });
}

export function checkForUpdate(platform: Platform, currentVersion: string): Promise<CheckResponse> {
  return apiRequest<CheckResponse>("/packages/check", { query: { platform, currentVersion } });
}

export function getPackageDownloadUrl(platform: Platform, version: string): string {
  return downloadUrl(`/packages/${platform}/${version}/download`);
}
