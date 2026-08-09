import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Express } from "express";

let app: Express;
let storageRoot: string;
let apiKey: string;
let projectId: string;

beforeAll(async () => {
  storageRoot = await fs.mkdtemp(path.join(os.tmpdir(), "openota-fcm-token-test-"));
  process.env.NODE_ENV = "test";
  process.env.STORAGE_ROOT = storageRoot;

  ({ app } = await import("../../../app.js"));
  const { initDb } = await import("../../../db/client.js");
  await initDb();

  const signup = await request(app).post("/api/v1/auth/signup").send({ email: "fcm-owner@example.test", password: "correct-horse-battery" });
  const cookie = signup.headers["set-cookie"][0];
  const project = await request(app).post("/api/v1/projects").set("Cookie", cookie).send({ name: "FCM Test Project" });
  projectId = project.body.data.id;
  const key = await request(app).post(`/api/v1/projects/${projectId}/api-keys`).set("Cookie", cookie).send({ name: "fcm-test-key" });
  apiKey = key.body.data.fullKey;
});

afterAll(async () => {
  await fs.rm(storageRoot, { recursive: true, force: true });
});

describe("POST /projects/:projectId/packages/fcm-token", () => {
  it("registers a real token — no auth required, mirrors check/download/report", async () => {
    const res = await request(app)
      .post(`/api/v1/projects/${projectId}/packages/fcm-token`)
      .send({ deviceId: "device-1", platform: "android", channel: "production", fcmToken: "fake-fcm-token-1" });
    expect(res.status).toBe(200);
    expect(res.body.data.registered).toBe(true);
  });

  it("rejects a missing fcmToken", async () => {
    const res = await request(app)
      .post(`/api/v1/projects/${projectId}/packages/fcm-token`)
      .send({ deviceId: "device-2", platform: "android", channel: "production" });
    expect(res.status).toBe(400);
  });

  it("re-registering the same device overwrites its token rather than duplicating", async () => {
    const { deviceTokensRepo } = await import("../../../db/repositories.js");
    await request(app)
      .post(`/api/v1/projects/${projectId}/packages/fcm-token`)
      .send({ deviceId: "device-3", platform: "android", channel: "production", fcmToken: "token-v1" });
    await request(app)
      .post(`/api/v1/projects/${projectId}/packages/fcm-token`)
      .send({ deviceId: "device-3", platform: "android", channel: "production", fcmToken: "token-v2" });

    const rows = await deviceTokensRepo.listByProjectPlatformChannel(projectId, "android", "production");
    const device3Rows = rows.filter((r) => r.device_id === "device-3");
    expect(device3Rows).toHaveLength(1);
    expect(device3Rows[0]!.fcm_token).toBe("token-v2");
  });

  it("uploading/rolling back a release still succeeds when push is unconfigured — notifyReleaseChange must never block the caller", async () => {
    const { createTestBundleZip } = await import("../../../test-utils/bundle-fixture.js");
    const zip = createTestBundleZip("index.android.bundle", "console.log('fcm-regression')");

    const uploadRes = await request(app)
      .post(`/api/v1/projects/${projectId}/packages`)
      .set("Authorization", `Bearer ${apiKey}`)
      .field("platform", "android")
      .field("channel", "production")
      .field("version", "1.0.0")
      .field("runtimeVersion", "1.0.0")
      .field("sha256", zip.sha256)
      .field("size", String(zip.size))
      .field("bundleName", "index.android.bundle")
      .attach("file", zip.buffer, "package.zip");

    expect(uploadRes.status).toBe(201);
  });
});
