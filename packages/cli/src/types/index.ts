import type { Manifest, Platform } from "@openota/shared";

export type { Platform, Manifest, CheckResponse } from "@openota/shared";

export interface OpenOtaConfig {
  serverUrl: string;
  deployment: string;
  platforms: Platform[];
  bundleOutput: string;
  apiKey?: string;
}

/** Build-environment metadata (not a package contract) — appVersion/toolchain versions used to produce a build. */
export interface BuildMetadata {
  appVersion: string;
  reactNativeVersion: string;
  nodeVersion: string;
  cliVersion: string;
}

export interface BundleResult {
  platform: Platform;
  bundlePath: string;
  bundleFilename: string;
  assetsDir: string;
}

export interface BuildResult {
  platform: Platform;
  version: string;
  outputDir: string;
  zipPath: string;
  manifest: Manifest;
  metadata: BuildMetadata;
}

export interface BuildOptions {
  version: string;
  platforms?: Platform[];
  dev?: boolean;
}

export interface UploadOptions {
  zipPath: string;
  platform: Platform;
  version: string;
  runtimeVersion: string;
  bundleName: string;
  sha256: string;
  size: number;
}

export interface DoctorCheckResult {
  name: string;
  ok: boolean;
  message: string;
}
