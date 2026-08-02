/**
 * The only message shape sent over the live-update WebSocket (see apps/server's
 * modules/live/registry.ts and the SDK's services/live.service.ts). Deliberately content-free —
 * it never carries manifest/version data, only a nudge to re-check. The staged-rollout gate in
 * package/service.ts's checkForUpdate stays the single source of truth for what a given device is
 * actually eligible for; duplicating that logic into the push payload would risk it drifting out
 * of sync or leaking "there's a new version" to a device the rollout percentage excludes.
 */
export interface LiveMessage {
  type: "release-changed";
}

export function isLiveMessage(value: unknown): value is LiveMessage {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    (value as { type: unknown }).type === "release-changed"
  );
}
