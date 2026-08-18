import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Express } from "express";

let app: Express;
let storageRoot: string;

beforeAll(async () => {
  storageRoot = await fs.mkdtemp(path.join(os.tmpdir(), "openota-devices-test-"));
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

/** A real device check-in, recorded as a side effect of hitting the open, device-facing
 * check-for-update endpoint — the same path a real app's OTA.check() call goes through. */
async function checkIn(projectId: string, deviceId: string) {
  const res = await request(app).get(
    `/api/v1/projects/${projectId}/packages/check?platform=android&currentVersion=1.0.0&deviceId=${deviceId}&runtimeVersion=1.0.0`,
  );
  expect(res.status).toBe(200);
}

describe("devices", () => {
  it("owner can list real device check-ins for their project", async () => {
    const cookie = await signup("devices-owner-a@example.test");
    const projectId = await createProject(cookie, "Devices Project A");
    await checkIn(projectId, "device-a-1");
    await checkIn(projectId, "device-a-2");

    const res = await request(app)
      .get(`/api/v1/projects/${projectId}/devices`)
      .set("Cookie", cookie)
      .set("X-Requested-With", "XMLHttpRequest");

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data.map((d: { device_id: string }) => d.device_id).sort()).toEqual(["device-a-1", "device-a-2"]);
  });

  it("another user cannot list device check-ins for a project they don't own", async () => {
    const ownerCookie = await signup("devices-owner-b@example.test");
    const projectId = await createProject(ownerCookie, "Devices Project B");
    await checkIn(projectId, "device-b-1");

    const attackerCookie = await signup("devices-attacker-b@example.test");
    const res = await request(app)
      .get(`/api/v1/projects/${projectId}/devices`)
      .set("Cookie", attackerCookie)
      .set("X-Requested-With", "XMLHttpRequest");

    expect(res.status).toBe(404);
  });

  it("requires a session (no cookie, no key) — 401", async () => {
    const cookie = await signup("devices-owner-c@example.test");
    const projectId = await createProject(cookie, "Devices Project C");

    const res = await request(app).get(`/api/v1/projects/${projectId}/devices`);
    expect(res.status).toBe(401);
  });
});
