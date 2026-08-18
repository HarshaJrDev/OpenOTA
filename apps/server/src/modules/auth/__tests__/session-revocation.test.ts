import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { authTokensRepo } from "../../../db/repositories.js";
import { generateRawToken, hashToken } from "../token.js";

import type { Express } from "express";

let app: Express;
let storageRoot: string;

beforeAll(async () => {
  storageRoot = await fs.mkdtemp(path.join(os.tmpdir(), "openota-session-revocation-test-"));
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

// Real, previously-missing coverage for the security-audit finding that stateless session tokens
// (30-day TTL, no server-side session table) survived "logout" and "reset password" until their
// own natural expiry. Both flows now bump users.sessions_revoked_at, and verifySessionToken
// rejects any token issued at or before that timestamp — see repositories.ts#revokeSessions,
// session.ts's issuedAt comment, and session.middleware.ts#resolveSessionUser.
describe("session revocation", () => {
  it("a session token is rejected immediately after logout, even though it hasn't expired", async () => {
    const signup = await request(app)
      .post("/api/v1/auth/signup")
      .send({ email: "revoke-logout@example.test", password: "correct-horse-battery" });
    expect(signup.status).toBe(201);
    const token = signup.body.data.token as string;

    const before = await request(app).get("/api/v1/auth/me").set("Authorization", `Bearer ${token}`);
    expect(before.status).toBe(200);

    const logout = await request(app).post("/api/v1/auth/logout").set("Authorization", `Bearer ${token}`);
    expect(logout.status).toBe(200);

    const after = await request(app).get("/api/v1/auth/me").set("Authorization", `Bearer ${token}`);
    expect(after.status).toBe(401);
  });

  it("logging out with an already-invalid token still succeeds (never blocks the client from clearing its own state)", async () => {
    const res = await request(app).post("/api/v1/auth/logout").set("Authorization", "Bearer not-a-real-token");
    expect(res.status).toBe(200);
    expect(res.body.data.loggedOut).toBe(true);
  });

  it("resetting a password invalidates every outstanding session token for that user", async () => {
    const signup = await request(app)
      .post("/api/v1/auth/signup")
      .send({ email: "revoke-reset@example.test", password: "correct-horse-battery" });
    expect(signup.status).toBe(201);
    const userId = signup.body.data.userId as string;
    const oldToken = signup.body.data.token as string;

    const before = await request(app).get("/api/v1/auth/me").set("Authorization", `Bearer ${oldToken}`);
    expect(before.status).toBe(200);

    // Seed a real reset-password token the same way authService.requestPasswordReset does — the
    // raw value only ever exists in memory before being emailed, so a test has no HTTP-visible way
    // to obtain one issued through /auth/forgot-password; this constructs an equivalent row via
    // the same exported hashing helpers the real flow uses, not a shortcut around it.
    const rawResetToken = generateRawToken();
    await authTokensRepo.create(
      userId,
      "reset_password",
      hashToken(rawResetToken),
      new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    );

    const reset = await request(app)
      .post("/api/v1/auth/reset-password")
      .send({ token: rawResetToken, password: "a-new-correct-horse" });
    expect(reset.status).toBe(200);

    const afterOldToken = await request(app).get("/api/v1/auth/me").set("Authorization", `Bearer ${oldToken}`);
    expect(afterOldToken.status).toBe(401);

    // The new password actually works — this isn't just "everything is broken now".
    const relogin = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "revoke-reset@example.test", password: "a-new-correct-horse" });
    expect(relogin.status).toBe(200);
  });

  it("a fresh login issued after a revocation is unaffected by the earlier revocation", async () => {
    const signup = await request(app)
      .post("/api/v1/auth/signup")
      .send({ email: "revoke-then-relogin@example.test", password: "correct-horse-battery" });
    const firstToken = signup.body.data.token as string;

    await request(app).post("/api/v1/auth/logout").set("Authorization", `Bearer ${firstToken}`);

    const login = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "revoke-then-relogin@example.test", password: "correct-horse-battery" });
    expect(login.status).toBe(200);
    const secondToken = login.body.data.token as string;

    const me = await request(app).get("/api/v1/auth/me").set("Authorization", `Bearer ${secondToken}`);
    expect(me.status).toBe(200);
  });
});
