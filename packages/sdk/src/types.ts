import type { Manifest } from "@openota/shared";

export type { Platform, Manifest, CheckResponse as CheckResult } from "@openota/shared";

export interface OtaConfig {
  serverUrl: string;
  channel: string;
  autoRestart: boolean;
  requestTimeout: number;
  headers?: Record<string, string>;
  /**
   * OpenOTA Cloud only: which project this app belongs to. When set, `checkForUpdate` targets the
   * project-scoped route (`/projects/{projectId}/packages/check`) — the isolated namespace that
   * `openota release`/`upload` write into. Omit for a self-hosted server with no project concept,
   * which uses the flat `/packages/check` route. Get this from the OpenOTA dashboard's Project
   * page, or `openota.config.json`'s `projectId` if you're wiring it up alongside the CLI.
   */
  projectId?: string;
}

export type OtaConfigInput = Partial<Omit<OtaConfig, "serverUrl">> & {
  serverUrl: string;
};

export interface DownloadResult {
  manifest: Manifest;
  zipPath: string;
}

export interface ExtractResult {
  manifest: Manifest;
  extractedDir: string;
  bundlePath: string;
}

/**
 * `manifest` is only populated when the install came from a fresh download (the JS SDK already
 * has the full manifest at that point). A rollback restores whatever native already had on disk —
 * the JS side never re-downloaded that manifest, so only the leaner native-reported fields are
 * available there. Callers that need version/bundlePath uniformly should read those two fields;
 * `manifest` is a bonus present on the common path.
 */
export interface InstallResult {
  manifest: Manifest | null;
  version: string | null;
  bundlePath: string | null;
}

export interface SyncResult {
  status: "up-to-date" | "updated" | "restart-required";
  manifest: Manifest | null;
}

export interface CurrentVersionInfo {
  version: string | null;
  bundlePath: string | null;
  manifest: Manifest | null;
}

export type SyncProgressStage =
  | "checking"
  | "downloading"
  | "extracting"
  | "verifying"
  | "installing"
  | "done";

export interface SyncProgressEvent {
  stage: SyncProgressStage;
  percent?: number;
}

export type SyncProgressListener = (event: SyncProgressEvent) => void;
