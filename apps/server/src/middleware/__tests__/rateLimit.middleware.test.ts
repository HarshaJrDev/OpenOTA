import express from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { errorMiddleware } from "../error.middleware.js";
import { sessionRateLimiter } from "../rateLimit.middleware.js";

/**
 * Tested against a throwaway Express app, not the real app.js — sessionRateLimiter's own `skip`
 * checks `NODE_ENV === "test"` (so the rest of the suite isn't throttled), so exercising the real
 * throttling behavior means temporarily lying about NODE_ENV around just this isolated mini-app,
 * without dragging in env.ts's production-only requirements (SESSION_SECRET, CORS posture, etc.)
 * that booting the real app.js under NODE_ENV=production would trigger.
 */
function buildTestApp() {
  const app = express();
  app.get("/probe", sessionRateLimiter, (_req, res) => res.json({ ok: true }));
  app.use(errorMiddleware);
  return app;
}

describe("sessionRateLimiter", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.NODE_ENV = "production";
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it("allows requests under the budget", async () => {
    const app = buildTestApp();
    const res = await request(app).get("/probe");
    expect(res.status).toBe(200);
  });

  it("returns a 429 with the standard error envelope once the per-IP budget is exceeded", async () => {
    const app = buildTestApp();

    let last: request.Response | undefined;
    for (let i = 0; i < 301; i++) {
      last = await request(app).get("/probe");
    }

    expect(last!.status).toBe(429);
    expect(last!.body.success).toBe(false);
    expect(last!.body.error.code).toBe("TOO_MANY_REQUESTS");
  });
});
