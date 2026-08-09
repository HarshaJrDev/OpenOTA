import type { WebSocket } from "ws";

import type { LiveMessage } from "@openota/shared";

import { appConfigsRepo, deviceTokensRepo } from "../../db/repositories.js";
import { logger } from "../../config/logger.js";
import { isPushConfigured, sendPushNotification } from "../push/fcm.js";

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

const DEFAULT_PUSH_TITLE = "App update available";
const DEFAULT_PUSH_BODY = "A new version is ready. Open the app to update.";

/**
 * The single call site every release/rollback/rollout-change should go through instead of calling
 * `liveRegistry.broadcast()` directly: does exactly what broadcast() always did (nudge any open
 * WebSocket connections), then — only if a project and push are both configured — fans a data-only
 * FCM push out to every device_tokens row on this exact (project, platform, channel), so a fully
 * killed app finds out too. Best-effort throughout: a push failure must never affect the
 * WS broadcast or the caller's own release/rollback flow, same posture the WS broadcast itself
 * already had (fire-and-forget, no return value).
 */
export async function notifyReleaseChange(projectId: string | undefined, platform: string, channel: string): Promise<void> {
  liveRegistry.broadcast(keyFor(projectId, platform, channel));

  if (!projectId || !isPushConfigured()) {
    return;
  }

  try {
    const [tokens, appConfig] = await Promise.all([
      deviceTokensRepo.listByProjectPlatformChannel(projectId, platform, channel),
      appConfigsRepo.findOne(projectId, platform),
    ]);
    if (tokens.length === 0) {
      return;
    }

    const title = appConfig?.push_title || DEFAULT_PUSH_TITLE;
    const body = appConfig?.push_body || DEFAULT_PUSH_BODY;
    const data = { type: "openota-release-changed", projectId, platform, channel, title, body };

    const results = await Promise.allSettled(tokens.map((t) => sendPushNotification(t.fcm_token, data)));
    const failures = results.filter((r) => r.status === "rejected" || r.status === "fulfilled" && r.value === false).length;
    if (failures > 0) {
      logger.warn({ projectId, platform, channel, failures, total: tokens.length }, "Some push notifications failed to send");
    }
  } catch (error) {
    logger.error({ err: error, projectId, platform, channel }, "notifyReleaseChange: push fan-out failed — WS broadcast already sent");
  }
}
