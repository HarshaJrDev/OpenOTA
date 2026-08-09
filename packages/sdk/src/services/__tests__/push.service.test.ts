import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("react-native-mmkv", () => {
  const store = new Map<string, string>();
  return {
    createMMKV: () => ({
      getString: (key: string) => store.get(key),
      set: (key: string, value: string) => void store.set(key, value),
      remove: (key: string) => void store.delete(key),
    }),
  };
});

// Captured (not reset per-test) — push.service.ts's tokenRefreshSubscribed guard means
// DeviceEventEmitter.addListener() only ever fires once across this whole file's module
// lifetime, whichever test happens to trigger it first. Every test that needs the handler reads
// it from here rather than assuming its own call is what registered it.
let capturedTokenRefreshHandler: ((token: string) => void) | undefined;
const addListenerMock = vi.hoisted(() => vi.fn());
vi.mock("react-native", () => ({
  Platform: { OS: "android" },
  DeviceEventEmitter: { addListener: addListenerMock },
}));

const nativeBridgeMock = vi.hoisted(() => ({
  registerForPushNotifications: vi.fn().mockResolvedValue(undefined),
  getFcmToken: vi.fn().mockResolvedValue("initial-token"),
}));
vi.mock("../../native/index.js", () => ({ nativeBridge: nativeBridgeMock }));

import { configure, resetConfig } from "../../config.js";
import { registerPush } from "../push.service.js";

beforeEach(() => {
  vi.clearAllMocks();
  addListenerMock.mockImplementation((_event: string, cb: (token: string) => void) => {
    capturedTokenRefreshHandler = cb;
    return { remove: vi.fn() };
  });
  nativeBridgeMock.getFcmToken.mockResolvedValue("initial-token");
});

afterEach(() => {
  resetConfig();
  vi.unstubAllGlobals();
});

describe("registerPush", () => {
  it("requests the permission, posts the current token, and never throws even without a projectId", async () => {
    configure({ serverUrl: "https://api.example.com/api/v1" }); // no projectId — self-hosted/flat mode
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(registerPush()).resolves.toBeUndefined();
    expect(nativeBridgeMock.registerForPushNotifications).toHaveBeenCalledTimes(1);
    // No projectId -> no server call at all, same "silently skip" posture as reportInstallResult.
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("POSTs the real token to /projects/:id/packages/fcm-token when a projectId is configured", async () => {
    configure({ serverUrl: "https://api.example.com/api/v1", projectId: "proj-1", channel: "production" });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({ success: true, data: {} }) });
    vi.stubGlobal("fetch", fetchMock);

    await registerPush();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toContain("/projects/proj-1/packages/fcm-token");
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body).toMatchObject({ platform: "android", channel: "production", fcmToken: "initial-token" });
  });

  it("a null token (Firebase not configured) is never posted, and never throws", async () => {
    nativeBridgeMock.getFcmToken.mockResolvedValueOnce(null);
    configure({ serverUrl: "https://api.example.com/api/v1", projectId: "proj-1" });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(registerPush()).resolves.toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("the captured token-refresh handler re-posts the rotated token when invoked", async () => {
    configure({ serverUrl: "https://api.example.com/api/v1", projectId: "proj-1" });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({ success: true, data: {} }) });
    vi.stubGlobal("fetch", fetchMock);

    await registerPush();
    // tokenRefreshSubscribed is a module-level idempotency guard — addListener() may have already
    // fired in an earlier test in this file rather than this exact call; capturedTokenRefreshHandler
    // is set whichever call actually registered it, real either way.
    expect(capturedTokenRefreshHandler).toBeDefined();

    fetchMock.mockClear();
    capturedTokenRefreshHandler!("rotated-token");
    await new Promise((resolve) => setTimeout(resolve, 0)); // flush the fire-and-forget post

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string);
    expect(body.fcmToken).toBe("rotated-token");
  });
});
