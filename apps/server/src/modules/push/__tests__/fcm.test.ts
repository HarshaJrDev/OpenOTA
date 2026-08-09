import { generateKeyPairSync } from "node:crypto";

import { afterEach, describe, expect, it, vi } from "vitest";

const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const FAKE_SERVICE_ACCOUNT = {
  project_id: "test-project-123",
  client_email: "fcm-test@test-project-123.iam.gserviceaccount.com",
  private_key: privateKey.export({ type: "pkcs1", format: "pem" }).toString(),
};

/**
 * env.ts's `env` object and fcm.ts's internal caches must come from the SAME module graph, or a
 * mutation on one instance is invisible to the other — vi.resetModules() clears everything, so env
 * and fcm.js are always (re-)imported together, right after resetting, never separately. Returns
 * both from one fresh graph per test.
 */
async function freshFcm() {
  vi.resetModules();
  const { env } = await import("../../../config/env.js");
  const fcm = await import("../fcm.js");
  return { env, ...fcm };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("isPushConfigured", () => {
  it("is false when FIREBASE_SERVICE_ACCOUNT_JSON is unset", async () => {
    const { isPushConfigured } = await freshFcm();
    expect(isPushConfigured()).toBe(false);
  });

  it("is false and never throws when the JSON is malformed", async () => {
    const { env, isPushConfigured } = await freshFcm();
    env.firebaseServiceAccountJson = "{ not valid json";
    expect(isPushConfigured()).toBe(false);
  });

  it("is false when required fields are missing", async () => {
    const { env, isPushConfigured } = await freshFcm();
    env.firebaseServiceAccountJson = JSON.stringify({ project_id: "only-this" });
    expect(isPushConfigured()).toBe(false);
  });

  it("is true with a complete, valid service account", async () => {
    const { env, isPushConfigured } = await freshFcm();
    env.firebaseServiceAccountJson = JSON.stringify(FAKE_SERVICE_ACCOUNT);
    expect(isPushConfigured()).toBe(true);
  });
});

describe("sendPushNotification", () => {
  it("returns false without ever calling fetch when push isn't configured", async () => {
    const { sendPushNotification } = await freshFcm();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendPushNotification("some-token", { type: "test" });
    expect(result).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("exchanges a correctly-shaped RS256 assertion for a token, then sends a DATA-ONLY message to the v1 send URL", async () => {
    const { env, sendPushNotification } = await freshFcm();
    env.firebaseServiceAccountJson = JSON.stringify(FAKE_SERVICE_ACCOUNT);

    const fetchMock = vi.fn(async (url: string | URL, init?: RequestInit) => {
      const href = url.toString();
      if (href === "https://oauth2.googleapis.com/token") {
        const body = new URLSearchParams(init!.body as string);
        expect(body.get("grant_type")).toBe("urn:ietf:params:oauth:grant-type:jwt-bearer");
        const assertion = body.get("assertion")!;
        const [headerB64, claimsB64] = assertion.split(".");
        const header = JSON.parse(Buffer.from(headerB64!, "base64url").toString());
        const claims = JSON.parse(Buffer.from(claimsB64!, "base64url").toString());
        expect(header.alg).toBe("RS256");
        expect(claims.iss).toBe(FAKE_SERVICE_ACCOUNT.client_email);
        expect(claims.scope).toBe("https://www.googleapis.com/auth/firebase.messaging");
        expect(claims.aud).toBe("https://oauth2.googleapis.com/token");
        return new Response(JSON.stringify({ access_token: "fake-bearer-token", expires_in: 3600 }), { status: 200 });
      }
      if (href === `https://fcm.googleapis.com/v1/projects/${FAKE_SERVICE_ACCOUNT.project_id}/messages:send`) {
        const body = JSON.parse(init!.body as string);
        expect(body.message.token).toBe("device-token-1");
        // Data-only: never a top-level "notification" key — the native layer must fully control
        // display, and killed-app delivery must still invoke app code.
        expect(body.message.notification).toBeUndefined();
        expect(body.message.data).toEqual({ type: "openota-release-changed" });
        expect(init!.headers).toMatchObject({ Authorization: "Bearer fake-bearer-token" });
        return new Response(JSON.stringify({ name: "projects/x/messages/1" }), { status: 200 });
      }
      throw new Error(`unexpected fetch to ${href}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendPushNotification("device-token-1", { type: "openota-release-changed" });

    expect(result).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("returns false (never throws) when the token exchange fails", async () => {
    const { env, sendPushNotification } = await freshFcm();
    env.firebaseServiceAccountJson = JSON.stringify(FAKE_SERVICE_ACCOUNT);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("unauthorized", { status: 401 })),
    );
    await expect(sendPushNotification("t", {})).resolves.toBe(false);
  });

  it("returns false (never throws) when the send itself fails", async () => {
    const { env, sendPushNotification } = await freshFcm();
    env.firebaseServiceAccountJson = JSON.stringify(FAKE_SERVICE_ACCOUNT);
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL) => {
        if (url.toString() === "https://oauth2.googleapis.com/token") {
          return new Response(JSON.stringify({ access_token: "tok", expires_in: 3600 }), { status: 200 });
        }
        return new Response("server error", { status: 500 });
      }),
    );
    await expect(sendPushNotification("t", {})).resolves.toBe(false);
  });

  it("caches the access token across calls — only one token exchange for two sends", async () => {
    const { env, sendPushNotification } = await freshFcm();
    env.firebaseServiceAccountJson = JSON.stringify(FAKE_SERVICE_ACCOUNT);
    let tokenExchanges = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL) => {
        if (url.toString() === "https://oauth2.googleapis.com/token") {
          tokenExchanges++;
          return new Response(JSON.stringify({ access_token: "tok", expires_in: 3600 }), { status: 200 });
        }
        return new Response(JSON.stringify({ name: "ok" }), { status: 200 });
      }),
    );
    await sendPushNotification("t1", {});
    await sendPushNotification("t2", {});
    expect(tokenExchanges).toBe(1);
  });
});
