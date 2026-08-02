import type { IncomingMessage, Server as HttpServer } from "node:http";
import type { Socket } from "node:net";
import { WebSocketServer, type WebSocket } from "ws";

import { logger } from "../../config/logger.js";
import { assertSafePathSegment } from "../../shared/utils.js";
import { keyFor, liveRegistry } from "./registry.js";

// Well under Render's ~55-60s idle-proxy timeout — the underlying native networking layer answers
// these pings transparently on the client side (no client JS ping code needed; see the SDK's
// live.service.ts doc comment), so this alone is what keeps a PaaS proxy from idling the
// connection out.
const HEARTBEAT_INTERVAL_MS = 30_000;

// deviceRateLimiter (Express middleware) never runs on raw `upgrade` events, so this ceiling is
// the only protection the upgrade path has against unbounded connection growth.
const MAX_CONCURRENT_CONNECTIONS = 2000;

interface ParsedLiveRequest {
  projectId?: string;
  platform: string;
  channel: string;
  deviceId?: string;
}

const PROJECT_PATH = /^\/api\/v1\/projects\/([^/]+)\/packages\/live\/?$/;
const FLAT_PATHS = new Set(["/api/v1/packages/live", "/packages/live"]);

function parseLiveRequest(url: URL): ParsedLiveRequest | null {
  const platform = url.searchParams.get("platform");
  const channel = url.searchParams.get("channel");
  if (!platform || !channel) {
    return null;
  }

  const projectMatch = url.pathname.match(PROJECT_PATH);
  if (projectMatch) {
    const projectId = projectMatch[1]!;
    try {
      assertSafePathSegment(projectId);
    } catch {
      return null;
    }
    return { projectId, platform, channel, deviceId: url.searchParams.get("deviceId") ?? undefined };
  }

  if (FLAT_PATHS.has(url.pathname)) {
    return { platform, channel, deviceId: url.searchParams.get("deviceId") ?? undefined };
  }

  return null;
}

/**
 * Attaches the live-update WebSocket server to the same http.Server Express is already listening
 * on. Express routing never sees raw `upgrade` events, so this is handled independently via
 * `noServer: true` + a manual `server.on("upgrade", ...)` — the standard `ws` + Express
 * coexistence pattern.
 */
export function attachLiveWebSocketServer(server: HttpServer): { close: () => void } {
  const wss = new WebSocketServer({ noServer: true });

  function onUpgrade(req: IncomingMessage, socket: Socket, head: Buffer): void {
    const url = new URL(req.url ?? "", "http://internal");
    const parsed = parseLiveRequest(url);

    if (!parsed) {
      socket.destroy();
      return;
    }
    if (liveRegistry.totalConnections() >= MAX_CONCURRENT_CONNECTIONS) {
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req, parsed);
    });
  }

  server.on("upgrade", onUpgrade);

  wss.on("connection", (ws: WebSocket, _req: IncomingMessage, parsed: ParsedLiveRequest) => {
    const key = keyFor(parsed.projectId, parsed.platform, parsed.channel);
    liveRegistry.add(key, ws);
    logger.debug({ key, deviceId: parsed.deviceId }, "live connection opened");

    let isAlive = true;
    ws.on("pong", () => {
      isAlive = true;
    });

    const heartbeat = setInterval(() => {
      if (!isAlive) {
        ws.terminate();
        return;
      }
      isAlive = false;
      ws.ping();
    }, HEARTBEAT_INTERVAL_MS);

    ws.on("close", () => {
      clearInterval(heartbeat);
      liveRegistry.remove(key, ws);
    });
    ws.on("error", (err) => {
      logger.debug({ err, key }, "live connection error");
    });
  });

  return {
    close: () => {
      server.off("upgrade", onUpgrade);
      liveRegistry.closeAll();
      wss.close();
    },
  };
}
