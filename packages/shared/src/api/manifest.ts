import type { Platform } from "../types/platform.js";

/**
 * The canonical shape of an OTA package manifest. This is the ONE Manifest type — the server, CLI
 * and SDK all read and write exactly this shape; no package may declare its own variant.
 *
 * Field naming note: the on-disk/wire JSON key for the package version has historically been
 * `version` (this is also what the native Android runtime's Kotlin parser reads today). The TS
 * field is named `bundleVersion` instead — clearer once `runtimeVersion` and `manifestVersion`
 * exist alongside it — and `schemas/manifest.schema.ts` maps the wire key `version` to this field
 * on parse and back to `version` on serialize, so the JSON format itself does not change and the
 * native Kotlin parser needs no update.
 *
 * `downloadUrl` is only present once the server has ingested the package (it doesn't exist yet in
 * the manifest the CLI writes to disk before upload), so it is optional here rather than forcing
 * a second near-identical type for "manifest before upload" vs "manifest after upload".
 */
export interface Manifest {
  manifestVersion: number;
  bundleVersion: string;
  platform: Platform;
  runtimeVersion: string;
  sha256: string;
  size: number;
  createdAt: string;
  bundleName: string;
  downloadUrl?: string;
  /** Relative paths of every asset file bundled alongside the JS bundle. */
  assets?: string[];
}

export function buildDownloadUrl(platform: Platform, version: string): string {
  return `/api/v1/packages/${platform}/${version}/download`;
}

/** Project-scoped counterpart of {@link buildDownloadUrl}, for OpenOTA Cloud multi-tenant routes. */
export function buildProjectDownloadUrl(projectId: string, platform: Platform, version: string): string {
  return `/api/v1/projects/${projectId}/packages/${platform}/${version}/download`;
}
