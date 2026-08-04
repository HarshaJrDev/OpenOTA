import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Express } from "express";

let app: Express;
let storageRoot: string;

beforeAll(async () => {
  storageRoot = await fs.mkdtemp(path.join(os.tmpdir(), "openota-health-test-"));
  process.env.NODE_ENV = "test";
  process.env.STORAGE_ROOT = storageRoot;
  delete process.env.OPENOTA_API_KEY;

  ({ app } = await import("../app.js"));
  const { initDb } = await import("../db/client.js");
  await initDb();
});

afterAll(async () => {
  await fs.rm(storageRoot, { recursive: true, force: true });
});

describe("GET /health", () => {
  it("reports real database and storage connectivity, not just process liveness", async () => {
    const res = await request(app).get("/health");

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("ok");
    expect(res.body.data.database).toBe("connected");
    expect(res.body.data.storage).toBe("connected");
    expect(res.body.data.storageProvider).toBe("local");
    expect(typeof res.body.data.version).toBe("string");
  });
});
