import fs from "node:fs/promises";
import { generateKeyPairSync } from "node:crypto";
import os from "node:os";
import path from "node:path";

import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import type { Express } from "express";

let app: Express;
let storageRoot: string;

beforeAll(async () => {
  storageRoot = await fs.mkdtemp(path.join(os.tmpdir(), "openota-notify-test-"));
  process.env.NODE_ENV = "test";
  process.env.STORAGE_ROOT = storageRoot;
  delete process.env.OPENOTA_API_KEY;

  const { privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  process.env.FIREBASE_SERVICE_ACCOUNT_JSON = JSON.stringify({
    client_email: "test-sa@test-project.iam.gserviceaccount.com",
    private_key: privateKey,
    project_id: "test-project",
  });

  ({ app } = await import("../../../app.js"));
  const { initDb } = await import("../../../db/client.js");
  await initDb();
});

afterAll(async () => {
  await fs.rm(storageRoot, { recursive: true, force: true });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function signup(email: string) {
  const res = await request(app).post("/api/v1/auth/signup").send({ email, password: "correct-horse-battery" });
  expect(res.status).toBe(201);
  const cookie = res.headers["set-cookie"];
  return Array.isArray(cookie) ? cookie[0] : cookie;
}

async function createProject(cookie: string, name: string) {
  const res = await request(app)
    .post("/api/v1/projects")
    .set("Cookie", cookie)
    .set("X-Requested-With", "XMLHttpRequest")
    .send({ name });
  expect(res.status).toBe(201);
  return res.body.data.id as string;
}

async function createApiKey(cookie: string, projectId: string) {
  const res = await request(app)
    .post(`/api/v1/projects/${projectId}/api-keys`)
    .set("Cookie", cookie)
    .set("X-Requested-With", "XMLHttpRequest")
    .send({ name: "ci-key" });
  expect(res.status).toBe(201);
  return res.body.data.fullKey as string;
}

function mockFcmFetch(sends: Array<{ token: string; data: Record<string, string> }>) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string | URL, init?: RequestInit) => {
      const href = url.toString();
      if (href === "https://oauth2.googleapis.com/token") {
        return new Response(JSON.stringify({ access_token: "fake-token", expires_in: 3600 }), { status: 200 });
      }
      if (href.includes("fcm.googleapis.com")) {
        const body = JSON.parse(String(init?.body ?? "{}")) as { message: { token: string; data: Record<string, string> } };
        sends.push({ token: body.message.token, data: body.message.data });
        return new Response(JSON.stringify({}), { status: 200 });
      }
      throw new Error(`unexpected fetch to ${href}`);
    }),
  );
}

describe("notifyReleaseChange -> FCM push (real HTTP routes, fetch mocked)", () => {
  it("a release upload sends an FCM push to every registered device token on that channel", async () => {
    const cookie = await signup("notify-owner-a@example.test");
    const projectId = await createProject(cookie, "Notify Project A");
    const apiKey = await createApiKey(cookie, projectId);

    await request(app)
      .post(`/api/v1/projects/${projectId}/packages/fcm-token`)
      .send({ deviceId: "device-1", platform: "android", channel: "production", fcmToken: "fcm-token-1" });

    const sends: Array<{ token: string; data: Record<string, string> }> = [];
    mockFcmFetch(sends);

    const uploadRes = await request(app)
      .post(`/api/v1/projects/${projectId}/packages`)
      .set("Authorization", `Bearer ${apiKey}`)
      .field("platform", "android")
      .field("version", "1.0.0")
      .field("runtimeVersion", "1.0.0")
      .field("bundleName", "index.android.bundle")
      .field("sha256", "a".repeat(64))
      .field("size", "18")
      .attach("file", Buffer.from("x"), { filename: "bundle.zip", contentType: "application/zip" });
    expect(uploadRes.status).toBe(201);

    expect(sends).toHaveLength(1);
    expect(sends[0]!.token).toBe("fcm-token-1");
    expect(sends[0]!.data.type).toBe("release-changed");
    expect(sends[0]!.data.title).toBe("App update available"); // default, no push_title configured
  });

  it("uses the operator-configured push_title/push_body from the Apps page when set", async () => {
    const cookie = await signup("notify-owner-b@example.test");
    const projectId = await createProject(cookie, "Notify Project B");
    const apiKey = await createApiKey(cookie, projectId);

    await request(app)
      .put(`/api/v1/projects/${projectId}/apps/android`)
      .set("Cookie", cookie)
      .set("X-Requested-With", "XMLHttpRequest")
      .send({ pushTitle: "Custom title!", pushBody: "Custom body!" });

    await request(app)
      .post(`/api/v1/projects/${projectId}/packages/fcm-token`)
      .send({ deviceId: "device-1", platform: "android", channel: "production", fcmToken: "fcm-token-2" });

    const sends: Array<{ token: string; data: Record<string, string> }> = [];
    mockFcmFetch(sends);

    await request(app)
      .post(`/api/v1/projects/${projectId}/packages`)
      .set("Authorization", `Bearer ${apiKey}`)
      .field("platform", "android")
      .field("version", "1.0.0")
      .field("runtimeVersion", "1.0.0")
      .field("bundleName", "index.android.bundle")
      .field("sha256", "a".repeat(64))
      .field("size", "18")
      .attach("file", Buffer.from("x"), { filename: "bundle.zip", contentType: "application/zip" });

    expect(sends).toHaveLength(1);
    expect(sends[0]!.data.title).toBe("Custom title!");
    expect(sends[0]!.data.body).toBe("Custom body!");
  });

  it("a device on a different channel does not receive the push", async () => {
    const cookie = await signup("notify-owner-c@example.test");
    const projectId = await createProject(cookie, "Notify Project C");
    const apiKey = await createApiKey(cookie, projectId);

    await request(app)
      .post(`/api/v1/projects/${projectId}/packages/fcm-token`)
      .send({ deviceId: "device-1", platform: "android", channel: "staging", fcmToken: "fcm-token-3" });

    const sends: Array<{ token: string; data: Record<string, string> }> = [];
    mockFcmFetch(sends);

    await request(app)
      .post(`/api/v1/projects/${projectId}/packages`)
      .set("Authorization", `Bearer ${apiKey}`)
      .field("platform", "android")
      .field("version", "1.0.0")
      .field("runtimeVersion", "1.0.0")
      .field("bundleName", "index.android.bundle")
      .field("sha256", "a".repeat(64))
      .field("size", "18")
      .attach("file", Buffer.from("x"), { filename: "bundle.zip", contentType: "application/zip" }); // defaults to production channel

    expect(sends).toHaveLength(0);
  });
});
