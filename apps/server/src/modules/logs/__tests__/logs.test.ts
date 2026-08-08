import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestBundleZip } from "../../../test-utils/bundle-fixture.js";

import type { Express } from "express";

let app: Express;
let storageRoot: string;

beforeAll(async () => {
  storageRoot = await fs.mkdtemp(path.join(os.tmpdir(), "openota-logs-test-"));
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

async function createApiKey(cookie: string, projectId: string, name = "ci-key") {
  const res = await request(app)
    .post(`/api/v1/projects/${projectId}/api-keys`)
    .set("Cookie", cookie)
    .set("X-Requested-With", "XMLHttpRequest")
    .send({ name });
  expect(res.status).toBe(201);
  return { fullKey: res.body.data.fullKey as string, name: res.body.data.name as string };
}

function upload(projectId: string, apiKey: string, version: string, channel?: string) {
  const bundle = createTestBundleZip("index.android.bundle", `console.log('${version}');`);
  const req = request(app)
    .post(`/api/v1/projects/${projectId}/packages`)
    .set("Authorization", `Bearer ${apiKey}`)
    .field("platform", "android")
    .field("version", version)
    .field("runtimeVersion", "1.0.0")
    .field("bundleName", "index.android.bundle")
    .field("sha256", bundle.sha256)
    .field("size", String(bundle.size));
  if (channel) req.field("channel", channel);
  return req.attach("file", bundle.buffer, { filename: "bundle.zip", contentType: "application/zip" });
}

describe("logs", () => {
  it("lists real deployment events across every channel, newest first, with the api key name resolved", async () => {
    const cookie = await signup("logs-owner-a@example.test");
    const projectId = await createProject(cookie, "Logs Project A");
    const { fullKey, name: keyName } = await createApiKey(cookie, projectId, "release-bot");

    await upload(projectId, fullKey, "1.0.0").expect(201);
    await upload(projectId, fullKey, "9.0.0", "staging").expect(201);

    const rollbackRes = await request(app)
      .post(`/api/v1/projects/${projectId}/packages/rollback`)
      .set("Authorization", `Bearer ${fullKey}`)
      .send({ platform: "android", version: "1.0.0", reason: "smoke test rollback" });
    expect(rollbackRes.status).toBe(200);

    const res = await request(app)
      .get(`/api/v1/projects/${projectId}/logs`)
      .set("Cookie", cookie)
      .set("X-Requested-With", "XMLHttpRequest");

    expect(res.status).toBe(200);
    const events = res.body.data as Array<{
      event_type: string;
      version: string;
      channel: string;
      actor_type: string;
      actor_name: string | null;
      reason: string | null;
      created_at: string;
    }>;

    // 3 real actions happened: release 1.0.0 (production), release 9.0.0 (staging), rollback to 1.0.0.
    expect(events).toHaveLength(3);
    // Newest first.
    expect(events[0]!.event_type).toBe("rollback");
    expect(events[0]!.reason).toBe("smoke test rollback");
    expect(events[0]!.actor_type).toBe("api_key");
    expect(events[0]!.actor_name).toBe(keyName);
    expect(events.some((e) => e.channel === "staging" && e.event_type === "release")).toBe(true);
  });

  it("filters by platform, channel, and event type", async () => {
    const cookie = await signup("logs-owner-b@example.test");
    const projectId = await createProject(cookie, "Logs Project B");
    const { fullKey } = await createApiKey(cookie, projectId);

    await upload(projectId, fullKey, "1.0.0").expect(201);
    await upload(projectId, fullKey, "2.0.0", "staging").expect(201);

    const stagingOnly = await request(app)
      .get(`/api/v1/projects/${projectId}/logs`)
      .query({ channel: "staging" })
      .set("Cookie", cookie)
      .set("X-Requested-With", "XMLHttpRequest");
    expect(stagingOnly.body.data).toHaveLength(1);
    expect(stagingOnly.body.data[0].version).toBe("2.0.0");

    const rollbacksOnly = await request(app)
      .get(`/api/v1/projects/${projectId}/logs`)
      .query({ eventType: "rollback" })
      .set("Cookie", cookie)
      .set("X-Requested-With", "XMLHttpRequest");
    expect(rollbacksOnly.body.data).toHaveLength(0);
  });

  it("rejects a user who doesn't own the project", async () => {
    const ownerCookie = await signup("logs-owner-c@example.test");
    const projectId = await createProject(ownerCookie, "Logs Project C");

    const attackerCookie = await signup("logs-attacker@example.test");
    const res = await request(app)
      .get(`/api/v1/projects/${projectId}/logs`)
      .set("Cookie", attackerCookie!)
      .set("X-Requested-With", "XMLHttpRequest");

    expect(res.status).toBe(404);
  });

  it("requires a session", async () => {
    const res = await request(app).get("/api/v1/projects/any-id/logs");
    expect(res.status).toBe(401);
  });
});
