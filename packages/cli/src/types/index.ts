import type { Manifest, Platform } from "@openota/shared";

export type { Platform, Manifest, CheckResponse } from "@openota/shared";

export interface OpenOtaConfig {
  serverUrl: string;
  deployment: string;
  platforms: Platform[];
  bundleOutput: string;
  apiKey?: string;
  /**
   * OpenOTA Cloud only: which project this app releases to. When set, upload/rollback target the
   * project-scoped routes (`/projects/{projectId}/packages/...`), correctly isolating releases per
   * project. Absent for self-hosted single-tenant servers, which use the flat `/packages` routes —
   * see `endpoints.ts`. Auto-filled by `openota login` when a project API key resolves one.
   */
  projectId?: string;
  /**
   * Native binary compatibility identifier — independent of both the OTA release `version` and
   * `package.json`'s `version`. An OTA bundle is only served to a device whose native runtime
   * reports this exact same value (see `BundleVerifier.kt`'s `INVALID_RUNTIME` check). Bump this
   * only when a native dependency or native API changes in a way that makes older JS bundles
   * unsafe to run against the new binary; ordinary JS-only releases keep it unchanged.
   */
  runtimeVersion: string;
  /** Which channel releases target by default when a command's `--channel` flag is omitted. Server default: "production". */
  channel?: string;
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
  channel?: string;
  releaseNotes?: string;
}

export interface DoctorCheckResult {
  name: string;
  ok: boolean;
  message: string;
}
