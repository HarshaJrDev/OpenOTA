import { LIVE_ENDPOINT, isLiveMessage } from "@openota/shared";

import { getConfig } from "../config.js";
import { otaStorage } from "../storage.js";
import type { Platform } from "../types.js";

const MAX_BACKOFF_MS = 30_000;
const BASE_BACKOFF_MS = 1_000;

/** Mirrors check.service.ts's resolveCheckEndpoint — same project-scoped-vs-flat namespace split. */
function resolveLiveEndpoint(projectId: string | undefined): string {
  return projectId ? `/projects/${projectId}${LIVE_ENDPOINT}` : LIVE_ENDPOINT;
}

function resolveLiveUrl(platform: Platform): string {
  const config = getConfig();
  // ws(s):// swap on the same host/path base apiGet already uses — no separate live-server config.
  const wsBase = config.serverUrl.replace(/^http/, "ws");
  const url = new URL(`${wsBase}${resolveLiveEndpoint(config.projectId)}`);
  url.searchParams.set("platform", platform);
  url.searchParams.set("channel", config.channel);
  url.searchParams.set("deviceId", otaStorage.getOrCreateDeviceId());
  return url.toString();
}

export interface LiveConnection {
  disconnect(): void;
}

/**
 * Live-update connection: reconnects with exponential backoff on any close/error. No client-side
 * ping — the browser/RN WebSocket API doesn't surface protocol-level pong events to JS (true of
 * the spec generally, not RN-specific), so the underlying native networking layer answers the
 * server's heartbeat pings transparently; onclose/onerror alone are what trigger a reconnect here.
 */
export function connectLive(platform: Platform, onReleaseChanged: () => void): LiveConnection {
  let socket: WebSocket | null = null;
  let stopped = false;
  let attempt = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  function scheduleReconnect(): void {
    if (stopped) {
      return;
    }
    const delay = Math.min(BASE_BACKOFF_MS * 2 ** attempt, MAX_BACKOFF_MS);
    attempt += 1;
    reconnectTimer = setTimeout(open, delay);
  }

  function open(): void {
    if (stopped) {
      return;
    }

    try {
      socket = new WebSocket(resolveLiveUrl(platform));
    } catch {
      scheduleReconnect();
      return;
    }

    socket.onopen = () => {
      attempt = 0;
    };

    socket.onmessage = (event) => {
      try {
        const data: unknown = JSON.parse(String(event.data));
        if (isLiveMessage(data)) {
          onReleaseChanged();
        }
      } catch {
        // Malformed frame — ignore rather than tear down an otherwise-healthy connection over it.
      }
    };

    socket.onclose = () => {
      socket = null;
      scheduleReconnect();
    };

    socket.onerror = () => {
      socket?.close();
    };
  }

  open();

  return {
    disconnect(): void {
      stopped = true;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      socket?.close();
      socket = null;
    },
  };
}
