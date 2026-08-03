import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Express } from "express";

let app: Express;
let storageRoot: string;

beforeAll(async () => {
  storageRoot = await fs.mkdtemp(path.join(os.tmpdir(), "openota-push-test-"));
  process.env.NODE_ENV = "test";
  process.env.STORAGE_ROOT = storageRoot;
  delete process.env.OPENOTA_API_KEY;

  ({ app } = await import("../../../app.js"));
  const { initDb } = await import("../../../db/client.js");
  await initDb();
});

afterAll(async () => {
  await fs.rm(storageRoot, { recursive: true, force: true });
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

describe("POST /projects/:projectId/packages/fcm-token", () => {
  it("registers a device token and it lands in device_tokens (visible via repeated upsert on the same device)", async () => {
    const { deviceTokensRepo } = await import("../../../db/repositories.js");
    const cookie = await signup("push-owner-a@example.test");
    const projectId = await createProject(cookie, "Push Project A");

    const res = await request(app)
      .post(`/api/v1/projects/${projectId}/packages/fcm-token`)
      .send({ deviceId: "device-1", platform: "android", channel: "production", fcmToken: "token-abc" });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ registered: true });

    const rows = await deviceTokensRepo.listByProjectPlatformChannel(projectId, "android", "production");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ device_id: "device-1", fcm_token: "token-abc" });
  });

  it("overwrites the token on re-registration from the same device (upsert, not a new row)", async () => {
    const { deviceTokensRepo } = await import("../../../db/repositories.js");
    const cookie = await signup("push-owner-b@example.test");
    const projectId = await createProject(cookie, "Push Project B");

    await request(app)
      .post(`/api/v1/projects/${projectId}/packages/fcm-token`)
      .send({ deviceId: "device-1", platform: "android", channel: "production", fcmToken: "old-token" });
    await request(app)
      .post(`/api/v1/projects/${projectId}/packages/fcm-token`)
      .send({ deviceId: "device-1", platform: "android", channel: "production", fcmToken: "new-token" });

    const rows = await deviceTokensRepo.listByProjectPlatformChannel(projectId, "android", "production");
    expect(rows).toHaveLength(1);
    expect(rows[0]!.fcm_token).toBe("new-token");
  });

  it("rejects a malformed body", async () => {
    const cookie = await signup("push-owner-c@example.test");
    const projectId = await createProject(cookie, "Push Project C");

    const res = await request(app)
      .post(`/api/v1/projects/${projectId}/packages/fcm-token`)
      .send({ deviceId: "device-1" }); // missing platform/channel/fcmToken

    expect(res.status).toBe(400);
  });

  it("requires no auth (device-facing, same posture as check/download/report)", async () => {
    const cookie = await signup("push-owner-d@example.test");
    const projectId = await createProject(cookie, "Push Project D");

    const res = await request(app)
      .post(`/api/v1/projects/${projectId}/packages/fcm-token`)
      .send({ deviceId: "device-1", platform: "android", channel: "production", fcmToken: "token-xyz" });

    expect(res.status).toBe(200); // no Authorization header, no session cookie set
  });
});
