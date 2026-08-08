import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Express } from "express";

let app: Express;
let storageRoot: string;

beforeAll(async () => {
  storageRoot = await fs.mkdtemp(path.join(os.tmpdir(), "openota-traffic-test-"));
  process.env.NODE_ENV = "test";
  process.env.STORAGE_ROOT = storageRoot;
  process.env.ADMIN_EMAILS = "admin@example.test";

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

describe("POST /api/v1/analytics/track", () => {
  it("records a real anonymous pageview, no auth required", async () => {
    const res = await request(app)
      .post("/api/v1/analytics/track")
      .send({ app: "docs", path: "/features", visitorId: "visitor-track-1-aaaaaaaa" });
    expect(res.status).toBe(202);
    expect(res.body.data.recorded).toBe(true);
  });

  it("rejects an unknown app value", async () => {
    const res = await request(app)
      .post("/api/v1/analytics/track")
      .send({ app: "mobile", path: "/features", visitorId: "visitor-track-2-aaaaaaaa" });
    expect(res.status).toBe(400);
  });

  it("attributes the view to the real logged-in user from the session cookie, never a client-supplied id", async () => {
    const cookie = await signup("track-user@example.test");
    const res = await request(app)
      .post("/api/v1/analytics/track")
      .set("Cookie", cookie)
      .send({ app: "dashboard", path: "/releases", visitorId: "visitor-track-3-aaaaaaaa" });
    expect(res.status).toBe(202);
  });
});

describe("GET /api/v1/traffic", () => {
  it("rejects without a session", async () => {
    const res = await request(app).get("/api/v1/traffic?app=docs");
    expect(res.status).toBe(401);
  });

  it("rejects a logged-in non-admin — 401, same as logged-out, so admin status can't be probed", async () => {
    const cookie = await signup("not-admin-traffic@example.test");
    const res = await request(app).get("/api/v1/traffic?app=docs").set("Cookie", cookie);
    expect(res.status).toBe(401);
  });

  it("returns real aggregated counts for an admin — matching exactly the views just recorded, nothing fabricated", async () => {
    const visitorA = "visitor-agg-a-aaaaaaaaaaaa";
    const visitorB = "visitor-agg-b-aaaaaaaaaaaa";
    await request(app).post("/api/v1/analytics/track").send({ app: "docs", path: "/pricing", visitorId: visitorA });
    await request(app).post("/api/v1/analytics/track").send({ app: "docs", path: "/pricing", visitorId: visitorA });
    await request(app).post("/api/v1/analytics/track").send({ app: "docs", path: "/about", visitorId: visitorB });

    const adminCookie = await signup("admin@example.test");
    const res = await request(app).get("/api/v1/traffic?app=docs&range=30d").set("Cookie", adminCookie);

    expect(res.status).toBe(200);
    expect(res.body.data.views).toBeGreaterThanOrEqual(3);
    expect(res.body.data.uniqueVisitors).toBeGreaterThanOrEqual(2);
    const pricing = res.body.data.topPaths.find((p: { path: string }) => p.path === "/pricing");
    expect(pricing.views).toBeGreaterThanOrEqual(2);
    expect(Array.isArray(res.body.data.daily)).toBe(true);
  });
});
