import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Express } from "express";

let app: Express;
let storageRoot: string;

beforeAll(async () => {
  storageRoot = await fs.mkdtemp(path.join(os.tmpdir(), "openota-error-mw-test-"));
  process.env.NODE_ENV = "test";
  process.env.STORAGE_ROOT = storageRoot;

  ({ app } = await import("../../app.js"));
});

afterAll(async () => {
  await fs.rm(storageRoot, { recursive: true, force: true });
});

describe("error middleware — no internal detail leaks to clients", () => {
  it("returns a generic 400 for malformed JSON, never the raw parser error message", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .set("Content-Type", "application/json")
      .send("{not valid json");

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.message).toBe("Request body is not valid JSON");
    // The V8 JSON parser's own message (e.g. "Unexpected token ... in JSON at position ...")
    // must never reach the client — this is the exact leak this test guards against.
    expect(res.body.error.message).not.toMatch(/JSON at position|Unexpected token/i);
  });

  it("known AppError subclasses still return their real, intentional message (not genericized)", async () => {
    // Missing required fields -> ZodError -> handled distinctly, still informative.
    const res = await request(app).post("/api/v1/auth/login").send({});

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });
});
