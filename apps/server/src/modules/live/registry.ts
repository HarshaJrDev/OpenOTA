import type { WebSocket } from "ws";

import type { LiveMessage } from "@openota/shared";

/**
 * `${projectId ?? "self-hosted"}:${platform}:${channel}` — the same identity a device's poll-path
 * check request is already scoped by (see package/service.ts's checkForUpdate cacheKey), just
 * reused as the fan-out key for live connections instead of a cache key.
 */
export type LiveKey = string;

export function keyFor(projectId: string | undefined, platform: string, channel: string): LiveKey {
  return `${projectId ?? "self-hosted"}:${platform}:${channel}`;
}

/**
 * In-memory only — consistent with this server's existing single-instance assumption (see
 * server.ts's warnAboutScalingRisks, activeReleaseCache in package/service.ts). Broadcasting a
 * release/rollback/rollout-percentage change here is a "check now" nudge, never the manifest
 * itself — see LiveMessage's doc comment for why.
 */
export function createLiveRegistry() {
  const connections = new Map<LiveKey, Set<WebSocket>>();

  function add(key: LiveKey, socket: WebSocket): void {
    let set = connections.get(key);
    if (!set) {
      set = new Set();
      connections.set(key, set);
    }
    set.add(socket);
  }

  function remove(key: LiveKey, socket: WebSocket): void {
    const set = connections.get(key);
    if (!set) {
      return;
    }
    set.delete(socket);
    if (set.size === 0) {
      connections.delete(key);
    }
  }

  function countFor(key: LiveKey): number {
    return connections.get(key)?.size ?? 0;
  }

  function broadcast(key: LiveKey): void {
    const set = connections.get(key);
    if (!set || set.size === 0) {
      return;
    }
    const message: LiveMessage = { type: "release-changed" };
    const payload = JSON.stringify(message);
    for (const socket of set) {
      if (socket.readyState === socket.OPEN) {
        socket.send(payload);
      }
    }
  }

  function totalConnections(): number {
    let total = 0;
    for (const set of connections.values()) {
      total += set.size;
    }
    return total;
  }

  function closeAll(): void {
    for (const set of connections.values()) {
      for (const socket of set) {
        socket.close(1001, "server shutting down");
      }
    }
    connections.clear();
  }

  return { add, remove, countFor, broadcast, totalConnections, closeAll };
}

export type LiveRegistry = ReturnType<typeof createLiveRegistry>;

/**
 * Process-global on purpose: broadcast() is called from package/service.ts and
 * environments/routes.ts, which otherwise have no shared channel back to the WS layer attached in
 * server.ts.
 */
export const liveRegistry: LiveRegistry = createLiveRegistry();
