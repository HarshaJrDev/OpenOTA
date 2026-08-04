import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import type { Express } from "express";

let storageRoot: string;

beforeAll(async () => {
  storageRoot = await fs.mkdtemp(path.join(os.tmpdir(), "openota-cors-test-"));
});

afterAll(async () => {
  await fs.rm(storageRoot, { recursive: true, force: true });
});

afterEach(() => {
  delete process.env.CORS_ALLOWED_ORIGINS;
  delete process.env.SESSION_SECRET;
  process.env.NODE_ENV = "test";
});

/** Each case needs its own fresh module registry — env.ts reads NODE_ENV/CORS_ALLOWED_ORIGINS once at import time. */
async function freshApp(): Promise<Express> {
  process.env.STORAGE_ROOT = storageRoot;
  vi.resetModules();
  const { app } = await import("../app.js");
  return app as Express;
}

describe("CORS credentials posture", () => {
  it("in production with CORS_ALLOWED_ORIGINS unset, does NOT grant credentials to a reflected origin (fails closed)", async () => {
    process.env.NODE_ENV = "production";
    process.env.SESSION_SECRET = "a".repeat(32);
    delete process.env.CORS_ALLOWED_ORIGINS;
    const app = await freshApp();

    const res = await request(app).get("/health").set("Origin", "https://attacker.example");

    expect(res.headers["access-control-allow-origin"]).toBe("https://attacker.example");
    expect(res.headers["access-control-allow-credentials"]).toBeUndefined();
  });

  it("in production with CORS_ALLOWED_ORIGINS set, grants credentials to that exact origin", async () => {
    process.env.NODE_ENV = "production";
    process.env.SESSION_SECRET = "a".repeat(32);
    process.env.CORS_ALLOWED_ORIGINS = "https://dashboard.example";
    const app = await freshApp();

    const res = await request(app).get("/health").set("Origin", "https://dashboard.example");

    expect(res.headers["access-control-allow-origin"]).toBe("https://dashboard.example");
    expect(res.headers["access-control-allow-credentials"]).toBe("true");
  });

  it("outside production (dev/test), still reflects any origin with credentials for local convenience", async () => {
    process.env.NODE_ENV = "development";
    delete process.env.CORS_ALLOWED_ORIGINS;
    const app = await freshApp();

    const res = await request(app).get("/health").set("Origin", "http://localhost:3000");

    expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:3000");
    expect(res.headers["access-control-allow-credentials"]).toBe("true");
  });
});
