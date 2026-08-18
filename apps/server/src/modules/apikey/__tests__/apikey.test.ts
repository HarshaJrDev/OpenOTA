import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Express } from "express";

let app: Express;
let storageRoot: string;

beforeAll(async () => {
  storageRoot = await fs.mkdtemp(path.join(os.tmpdir(), "openota-apikey-test-"));
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

async function createApiKey(cookie: string, projectId: string) {
  const res = await request(app)
    .post(`/api/v1/projects/${projectId}/api-keys`)
    .set("Cookie", cookie)
    .set("X-Requested-With", "XMLHttpRequest")
    .send({ name: "ci-key" });
  expect(res.status).toBe(201);
  return res.body.data.id as string;
}

// Tenant-isolation.test.ts already covers cross-*project* API-key *usage* (a Project A key
// presented as a Bearer token against Project B's routes). What's missing — and what this file
// covers — is the *dashboard session* path: a logged-in user who does not own the project at all,
// trying to create/list/revoke API keys via their own session cookie rather than a stolen key.
describe("api-key ownership (session-authenticated dashboard path)", () => {
  it("a non-owner session cannot list another user's project's API keys", async () => {
    const ownerCookie = await signup("apikey-owner-a@example.test");
    const projectId = await createProject(ownerCookie, "API Key Project A");
    await createApiKey(ownerCookie, projectId);

    const attackerCookie = await signup("apikey-attacker-a@example.test");
    const res = await request(app)
      .get(`/api/v1/projects/${projectId}/api-keys`)
      .set("Cookie", attackerCookie)
      .set("X-Requested-With", "XMLHttpRequest");

    expect(res.status).toBe(404);
  });

  it("a non-owner session cannot create an API key for another user's project", async () => {
    const ownerCookie = await signup("apikey-owner-b@example.test");
    const projectId = await createProject(ownerCookie, "API Key Project B");

    const attackerCookie = await signup("apikey-attacker-b@example.test");
    const res = await request(app)
      .post(`/api/v1/projects/${projectId}/api-keys`)
      .set("Cookie", attackerCookie)
      .set("X-Requested-With", "XMLHttpRequest")
      .send({ name: "attacker-key" });

    expect(res.status).toBe(404);

    // Confirm nothing was actually created — the owner's own key list is unaffected.
    const list = await request(app)
      .get(`/api/v1/projects/${projectId}/api-keys`)
      .set("Cookie", ownerCookie)
      .set("X-Requested-With", "XMLHttpRequest");
    expect(list.body.data).toHaveLength(0);
  });

  it("a non-owner session cannot revoke another user's project's API key", async () => {
    const ownerCookie = await signup("apikey-owner-c@example.test");
    const projectId = await createProject(ownerCookie, "API Key Project C");
    const keyId = await createApiKey(ownerCookie, projectId);

    const attackerCookie = await signup("apikey-attacker-c@example.test");
    const res = await request(app)
      .delete(`/api/v1/projects/${projectId}/api-keys/${keyId}`)
      .set("Cookie", attackerCookie)
      .set("X-Requested-With", "XMLHttpRequest");

    expect(res.status).toBe(404);

    // The key is still alive from the real owner's point of view.
    const list = await request(app)
      .get(`/api/v1/projects/${projectId}/api-keys`)
      .set("Cookie", ownerCookie)
      .set("X-Requested-With", "XMLHttpRequest");
    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0].revoked_at).toBeNull();
  });

  it("a session belonging to a project's real owner CAN list, create, and revoke that project's keys", async () => {
    const cookie = await signup("apikey-owner-d@example.test");
    const projectId = await createProject(cookie, "API Key Project D");
    const keyId = await createApiKey(cookie, projectId);

    const list = await request(app)
      .get(`/api/v1/projects/${projectId}/api-keys`)
      .set("Cookie", cookie)
      .set("X-Requested-With", "XMLHttpRequest");
    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(1);

    const revoke = await request(app)
      .delete(`/api/v1/projects/${projectId}/api-keys/${keyId}`)
      .set("Cookie", cookie)
      .set("X-Requested-With", "XMLHttpRequest");
    expect(revoke.status).toBe(200);
  });

  it("requires a session — no cookie, no key — 401", async () => {
    const cookie = await signup("apikey-owner-e@example.test");
    const projectId = await createProject(cookie, "API Key Project E");

    const res = await request(app).get(`/api/v1/projects/${projectId}/api-keys`);
    expect(res.status).toBe(401);
  });
});
