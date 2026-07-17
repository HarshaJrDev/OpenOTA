/**
 * Mirrors the native runtime's state machine (see `packages/native-android`'s `RuntimeState.kt`).
 * This is the single TS-side source of truth for the lifecycle vocabulary — the dashboard, SDK
 * diagnostics, and any future native-iOS bridge should all read/report these exact string values.
 */
export const RUNTIME_STATES = [
  "EMBEDDED",
  "DOWNLOADED",
  "VERIFIED",
  "EXTRACTED",
  "INSTALLED",
  "ACTIVATED",
  "FAILED",
  "ROLLBACK",
] as const;

export type RuntimeState = (typeof RUNTIME_STATES)[number];

/**
 * TS mirror of the native transition table. Kept here (not enforced) so any TS-side consumer that
 * wants to reason about "what can happen next" — a dashboard timeline view, a test — has one
 * definition to read instead of re-deriving it from native source. The native runtime remains the
 * enforcing authority; this is documentation-as-code, not a second enforcement point.
 */
export const RUNTIME_STATE_TRANSITIONS: Readonly<Record<RuntimeState, readonly RuntimeState[]>> = {
  EMBEDDED: ["DOWNLOADED"],
  DOWNLOADED: ["VERIFIED", "FAILED"],
  VERIFIED: ["EXTRACTED", "FAILED"],
  EXTRACTED: ["INSTALLED", "FAILED"],
  INSTALLED: ["ACTIVATED", "FAILED"],
  ACTIVATED: ["FAILED", "ROLLBACK", "DOWNLOADED"],
  FAILED: ["ROLLBACK", "DOWNLOADED", "EMBEDDED"],
  ROLLBACK: ["ACTIVATED", "EMBEDDED"],
};

export function isRuntimeState(value: unknown): value is RuntimeState {
  return typeof value === "string" && (RUNTIME_STATES as readonly string[]).includes(value);
}
