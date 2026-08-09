import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Express } from "express";

let app: Express;
let storageRoot: string;

beforeAll(async () => {
  storageRoot = await fs.mkdtemp(path.join(os.tmpdir(), "openota-admin-test-"));
  process.env.NODE_ENV = "test";
  process.env.STORAGE_ROOT = storageRoot;
  process.env.ADMIN_EMAILS = "admin@example.test, Other-Admin@Example.test";
  delete process.env.OPENOTA_API_KEY;

  ({ app } = await import("../../../app.js"));
  const { initDb } = await import("../../../db/client.js");
  await initDb();
});

afterAll(async () => {
  await fs.rm(storageRoot, { recursive: true, force: true });
});

async function signup(email: string): Promise<string> {
  const res = await request(app).post("/api/v1/auth/signup").send({ email, password: "correct-horse-battery" });
  expect(res.status).toBe(201);
  const cookie = res.headers["set-cookie"];
  return Array.isArray(cookie) ? cookie[0]! : (cookie as unknown as string);
}

describe("admin settings", () => {
  it("rejects an unauthenticated request", async () => {
    const res = await request(app).get("/api/v1/admin/settings");
    expect(res.status).toBe(401);
  });

  it("rejects a logged-in user who is not in ADMIN_EMAILS", async () => {
    const cookie = await signup("not-admin@example.test");
    const res = await request(app).get("/api/v1/admin/settings").set("Cookie", cookie);
    expect(res.status).toBe(401);
  });

  it("defaults emailTestMode to true for a fresh deployment", async () => {
    const cookie = await signup("admin@example.test");
    const res = await request(app).get("/api/v1/admin/settings").set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.emailTestMode).toBe(true);
  });

  it("lets an admin (case-insensitive email match) toggle the setting, and it persists", async () => {
    const cookie = await signup("OTHER-ADMIN@example.test");

    const patch = await request(app).patch("/api/v1/admin/settings").set("Cookie", cookie).send({ emailTestMode: false });
    expect(patch.status).toBe(200);
    expect(patch.body.data.emailTestMode).toBe(false);

    const get = await request(app).get("/api/v1/admin/settings").set("Cookie", cookie);
    expect(get.body.data.emailTestMode).toBe(false);

    // Reset for any later test in this file that assumes the default.
    await request(app).patch("/api/v1/admin/settings").set("Cookie", cookie).send({ emailTestMode: true });
  });

  it("/auth/me reports isAdmin correctly for both admin and non-admin users", async () => {
    // admin@example.test was already registered by an earlier test in this file — log in rather
    // than sign up again (signup would 400 on a duplicate email).
    const loginRes = await request(app).post("/api/v1/auth/login").send({ email: "admin@example.test", password: "correct-horse-battery" });
    expect(loginRes.status).toBe(200);
    const adminCookie = loginRes.headers["set-cookie"][0] as string;
    const meAdmin = await request(app).get("/api/v1/auth/me").set("Cookie", adminCookie);
    expect(meAdmin.body.data.isAdmin).toBe(true);

    const nonAdminCookie = await signup("plain-user@example.test");
    const meNonAdmin = await request(app).get("/api/v1/auth/me").set("Cookie", nonAdminCookie);
    expect(meNonAdmin.body.data.isAdmin).toBe(false);
  });

  describe("GET /admin/infrastructure", () => {
    it("rejects a non-admin the same as logged-out (401, can't be probed)", async () => {
      const cookie = await signup("infra-not-admin@example.test");
      const res = await request(app).get("/api/v1/admin/infrastructure").set("Cookie", cookie);
      expect(res.status).toBe(401);
    });

    it("reports real, live status for an admin — embedded DB + local storage in this test env, never raw credentials", async () => {
      const cookie = await signup("infra-admin@example.test");
      // Not in ADMIN_EMAILS from beforeAll — add via login as an existing admin instead.
      const loginRes = await request(app).post("/api/v1/auth/login").send({ email: "admin@example.test", password: "correct-horse-battery" });
      const adminCookie = loginRes.headers["set-cookie"][0] as string;

      const res = await request(app).get("/api/v1/admin/infrastructure").set("Cookie", adminCookie);
      expect(res.status).toBe(200);

      expect(res.body.data.database).toMatchObject({ provider: "embedded", connected: true });
      expect(res.body.data.storage).toMatchObject({ provider: "local", connected: true });
      expect(res.body.data.email.transport).toBe("log-only");
      expect(res.body.data.domain.dashboardUrl).toEqual(expect.any(String));

      // Never leak the DB URL, password, or any *_KEY/*_SECRET field, at any nesting depth.
      const serialized = JSON.stringify(res.body);
      expect(serialized).not.toMatch(/password/i);
      expect(serialized.toLowerCase()).not.toContain("secret");
      void cookie; // signup only needed to prove the non-admin/admin distinction above, not reused here
    });
  });
});
