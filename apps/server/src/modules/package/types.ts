import type { Platform } from "@openota/shared";

export type { Platform, Manifest, PackageMetadata, CheckResponse as CheckUpdateResult } from "@openota/shared";

export interface UploadPackageInput {
  platform: Platform;
  version: string;
  runtimeVersion: string;
  bundleName: string;
  sha256: string;
  size: number;
  assets?: string[];
  tempFilePath: string;
  mimeType: string;
  /** Which channel's active pointer this release becomes. Defaults to "production" if omitted. */
  channel?: string;
}
