import { generateKeyPairSync, verify } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildAssertion, type FirebaseServiceAccount } from "../fcm.js";

const { publicKey, privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});

const account: FirebaseServiceAccount = {
  client_email: "test-sa@test-project.iam.gserviceaccount.com",
  private_key: privateKey,
  project_id: "test-project",
};

function decodeSegment(segment: string): unknown {
  return JSON.parse(Buffer.from(segment, "base64url").toString("utf8"));
}

describe("buildAssertion", () => {
  it("produces a well-formed RS256 JWT with the correct claims", () => {
    const now = new Date("2026-01-01T00:00:00Z").getTime();
    const jwt = buildAssertion(account, now);
    const parts = jwt.split(".");
    expect(parts).toHaveLength(3);

    const header = decodeSegment(parts[0]!) as { alg: string; typ: string };
    expect(header).toEqual({ alg: "RS256", typ: "JWT" });

    const claims = decodeSegment(parts[1]!) as { iss: string; scope: string; aud: string; iat: number; exp: number };
    expect(claims.iss).toBe(account.client_email);
    expect(claims.scope).toBe("https://www.googleapis.com/auth/firebase.messaging");
    expect(claims.aud).toBe("https://oauth2.googleapis.com/token");
    expect(claims.exp - claims.iat).toBe(3600);
  });

  it("produces a signature that verifies against the matching public key", () => {
    const jwt = buildAssertion(account);
    const [header, claims, signature] = jwt.split(".");
    const signingInput = `${header}.${claims}`;

    const verified = verify(
      "RSA-SHA256",
      Buffer.from(signingInput),
      publicKey,
      Buffer.from(signature!, "base64url"),
    );
    expect(verified).toBe(true);
  });
});

describe("token exchange + send (fetch-mocked)", () => {
  beforeEach(() => {
    process.env.NODE_ENV = "test";
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON = JSON.stringify(account);
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  });

  it("isPushConfigured() is true once a valid service account JSON is set", async () => {
    const fcm = await import("../fcm.js");
    expect(fcm.isPushConfigured()).toBe(true);
  });

  it("isPushConfigured() is false when unset", async () => {
    delete process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    vi.resetModules();
    const fcm = await import("../fcm.js");
    expect(fcm.isPushConfigured()).toBe(false);
  });

  it("isPushConfigured() is false when the JSON is malformed", async () => {
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON = "not json";
    vi.resetModules();
    const fcm = await import("../fcm.js");
    expect(fcm.isPushConfigured()).toBe(false);
  });

  it("sendPushNotification exchanges for a token then sends a DATA-ONLY message to the v1 endpoint", async () => {
    const fcm = await import("../fcm.js");
    const calls: { url: string; body: string }[] = [];

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL, init?: RequestInit) => {
        const href = url.toString();
        calls.push({ url: href, body: String(init?.body ?? "") });

        if (href === "https://oauth2.googleapis.com/token") {
          return new Response(JSON.stringify({ access_token: "fake-access-token", expires_in: 3600 }), { status: 200 });
        }
        if (href.includes("fcm.googleapis.com")) {
          return new Response(JSON.stringify({ name: "projects/test-project/messages/1" }), { status: 200 });
        }
        throw new Error(`unexpected fetch to ${href}`);
      }),
    );

    await fcm.sendPushNotification("device-token-abc", { type: "release-changed", title: "Update ready", body: "Tap to update" });

    const sendCall = calls.find((c) => c.url.includes("fcm.googleapis.com"));
    expect(sendCall).toBeDefined();
    expect(sendCall!.url).toBe("https://fcm.googleapis.com/v1/projects/test-project/messages:send");

    const parsedBody = JSON.parse(sendCall!.body);
    expect(parsedBody).toEqual({
      message: {
        token: "device-token-abc",
        data: { type: "release-changed", title: "Update ready", body: "Tap to update" },
      },
    });
    expect(parsedBody.message.notification).toBeUndefined();
  });

  it("caches the access token across sends and only re-exchanges once past expiry", async () => {
    const fcm = await import("../fcm.js");
    let tokenExchanges = 0;
    let now = Date.now();
    vi.spyOn(Date, "now").mockImplementation(() => now);

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL) => {
        const href = url.toString();
        if (href === "https://oauth2.googleapis.com/token") {
          tokenExchanges += 1;
          return new Response(JSON.stringify({ access_token: `token-${tokenExchanges}`, expires_in: 3600 }), { status: 200 });
        }
        return new Response(JSON.stringify({}), { status: 200 });
      }),
    );

    await fcm.sendPushNotification("device-1", { type: "release-changed", title: "t", body: "b" });
    await fcm.sendPushNotification("device-2", { type: "release-changed", title: "t", body: "b" });
    expect(tokenExchanges).toBe(1); // second send reused the cached token

    now += 3600 * 1000; // past expiry
    await fcm.sendPushNotification("device-3", { type: "release-changed", title: "t", body: "b" });
    expect(tokenExchanges).toBe(2); // re-exchanged once expired
  });
});
