import { describe, expect, it, vi } from "vitest";

import { createLiveRegistry, keyFor } from "../registry.js";

function fakeSocket(readyState = 1) {
  return { readyState, OPEN: 1, send: vi.fn(), close: vi.fn() } as unknown as import("ws").WebSocket;
}

describe("live registry", () => {
  it("keys self-hosted connections separately from project-scoped ones", () => {
    expect(keyFor(undefined, "android", "production")).toBe("self-hosted:android:production");
    expect(keyFor("proj1", "android", "production")).toBe("proj1:android:production");
    expect(keyFor("proj1", "ios", "production")).not.toBe(keyFor("proj1", "android", "production"));
  });

  it("broadcasts only to sockets registered under the matching key", () => {
    const registry = createLiveRegistry();
    const matchSocket = fakeSocket();
    const otherChannelSocket = fakeSocket();
    registry.add(keyFor("p1", "android", "production"), matchSocket);
    registry.add(keyFor("p1", "android", "staging"), otherChannelSocket);

    registry.broadcast(keyFor("p1", "android", "production"));

    expect(matchSocket.send).toHaveBeenCalledWith(JSON.stringify({ type: "release-changed" }));
    expect(otherChannelSocket.send).not.toHaveBeenCalled();
  });

  it("does not send to a socket that isn't OPEN", () => {
    const registry = createLiveRegistry();
    const closingSocket = fakeSocket(2); // CLOSING
    registry.add(keyFor("p1", "android", "production"), closingSocket);

    registry.broadcast(keyFor("p1", "android", "production"));

    expect(closingSocket.send).not.toHaveBeenCalled();
  });

  it("countFor reflects add/remove", () => {
    const registry = createLiveRegistry();
    const key = keyFor("p1", "android", "production");
    const a = fakeSocket();
    const b = fakeSocket();

    expect(registry.countFor(key)).toBe(0);
    registry.add(key, a);
    registry.add(key, b);
    expect(registry.countFor(key)).toBe(2);
    registry.remove(key, a);
    expect(registry.countFor(key)).toBe(1);
    registry.remove(key, b);
    expect(registry.countFor(key)).toBe(0);
  });

  it("totalConnections sums across every key", () => {
    const registry = createLiveRegistry();
    registry.add(keyFor("p1", "android", "production"), fakeSocket());
    registry.add(keyFor("p1", "ios", "production"), fakeSocket());
    registry.add(keyFor("p2", "android", "production"), fakeSocket());

    expect(registry.totalConnections()).toBe(3);
  });

  it("closeAll closes every socket and clears the registry", () => {
    const registry = createLiveRegistry();
    const key = keyFor("p1", "android", "production");
    const a = fakeSocket();
    const b = fakeSocket();
    registry.add(key, a);
    registry.add(key, b);

    registry.closeAll();

    expect(a.close).toHaveBeenCalledWith(1001, "server shutting down");
    expect(b.close).toHaveBeenCalledWith(1001, "server shutting down");
    expect(registry.countFor(key)).toBe(0);
    expect(registry.totalConnections()).toBe(0);
  });

  it("a broadcast on a key with no connections is a safe no-op", () => {
    const registry = createLiveRegistry();
    expect(() => registry.broadcast(keyFor("nobody", "android", "production"))).not.toThrow();
  });
});
