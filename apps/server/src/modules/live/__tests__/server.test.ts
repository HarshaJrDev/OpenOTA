import { createServer, type Server } from "node:http";
import { WebSocket } from "ws";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Express } from "express";

import { attachLiveWebSocketServer } from "../server.js";
import { keyFor, liveRegistry } from "../registry.js";

let app: Express;
let server: Server;
let baseUrl: string;
let close: () => void;

beforeAll(async () => {
  process.env.NODE_ENV = "test";
  ({ app } = await import("../../../app.js"));

  server = createServer(app);
  ({ close } = attachLiveWebSocketServer(server));

  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("expected server to listen on a port");
  }
  baseUrl = `ws://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  close();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

function waitForOpen(ws: WebSocket): Promise<void> {
  return new Promise((resolve, reject) => {
    ws.once("open", () => resolve());
    ws.once("error", reject);
  });
}

function waitForClose(ws: WebSocket): Promise<number> {
  return new Promise((resolve) => {
    ws.once("close", (code) => resolve(code));
  });
}

// The client's own "close" event fires independently of when the *server* processes its side of
// the close and removes the socket from the registry — polling avoids a same-tick race between
// the two.
async function waitUntil(check: () => boolean, timeoutMs = 2000): Promise<void> {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error("waitUntil timed out");
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

// A rejected upgrade is `socket.destroy()`-ed before any WS handshake completes, so the client
// never gets a clean protocol-level "close" (with a code) — it sees an abrupt "error" (connection
// reset), same as any other socket destroyed pre-handshake.
function waitForRejection(ws: WebSocket): Promise<void> {
  return new Promise((resolve) => {
    ws.once("error", () => resolve());
    ws.once("close", () => resolve());
  });
}

describe("live WebSocket server", () => {
  it("accepts a valid self-hosted-flat connection and registers it in the registry", async () => {
    const ws = new WebSocket(`${baseUrl}/api/v1/packages/live?platform=android&channel=production&deviceId=d1`);
    await waitForOpen(ws);

    expect(liveRegistry.countFor(keyFor(undefined, "android", "production"))).toBe(1);

    ws.close();
    await waitForClose(ws);
    await waitUntil(() => liveRegistry.countFor(keyFor(undefined, "android", "production")) === 0);
  });

  it("accepts a valid project-scoped connection and registers it under the project's key", async () => {
    const ws = new WebSocket(`${baseUrl}/api/v1/projects/proj-123/packages/live?platform=ios&channel=staging&deviceId=d2`);
    await waitForOpen(ws);

    expect(liveRegistry.countFor(keyFor("proj-123", "ios", "staging"))).toBe(1);

    ws.close();
    await waitForClose(ws);
  });

  it("rejects a connection missing required query params", async () => {
    const ws = new WebSocket(`${baseUrl}/api/v1/packages/live?platform=android`); // no channel
    await waitForRejection(ws);
    expect(ws.readyState).not.toBe(WebSocket.OPEN);
  });

  it("rejects a connection to an unrecognized path", async () => {
    const ws = new WebSocket(`${baseUrl}/api/v1/not-a-real-path?platform=android&channel=production`);
    await waitForRejection(ws);
    expect(ws.readyState).not.toBe(WebSocket.OPEN);
  });

  it("a broadcast reaches an open connection registered for that exact key", async () => {
    const ws = new WebSocket(`${baseUrl}/api/v1/packages/live?platform=android&channel=production&deviceId=d3`);
    await waitForOpen(ws);

    const messageReceived = new Promise<string>((resolve) => {
      ws.once("message", (data) => resolve(data.toString()));
    });

    liveRegistry.broadcast(keyFor(undefined, "android", "production"));

    const message = await messageReceived;
    expect(JSON.parse(message)).toEqual({ type: "release-changed" });

    ws.close();
    await waitForClose(ws);
  });
});
