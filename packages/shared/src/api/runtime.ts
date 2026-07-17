import type { RuntimeState } from "../types/state.js";

/**
 * TS mirror of the native runtime's root-level `manifest.json` (see `RuntimeManifest.kt`). Not
 * currently read directly by the SDK (it goes through the leaner `RuntimeInfo` bridge return
 * value instead) — this exists so a future diagnostics dashboard or native-iOS port has one
 * documented shape to target instead of re-deriving it from Kotlin source.
 */
export interface RuntimeManifest {
  activeVersion: string | null;
  activeBundlePath: string | null;
  runtimeVersion: string | null;
  manifestVersion: number | null;
  installTimeMillis: number | null;
  state: RuntimeState;
  bootConfirmed: boolean;
  bootAttempts: number;
}

/** The shape returned by the native `getRuntimeInfo()` / `activateBundle()` / `rollback()` TurboModule methods. */
export interface RuntimeInfo {
  currentVersion: string | null;
  bundleVersion: string | null;
  runtimeVersion: string | null;
  manifestVersion: number | null;
  bundlePath: string | null;
  installTime: number | null;
  platform: string;
  state: RuntimeState;
}
