import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import type { Express } from "express";

let app: Express;
let storageRoot: string;

beforeAll(async () => {
  storageRoot = await fs.mkdtemp(path.join(os.tmpdir(), "openota-google-test-"));
  process.env.NODE_ENV = "test";
  process.env.STORAGE_ROOT = storageRoot;
  process.env.GOOGLE_CLIENT_ID = "test-client-id";
  process.env.GOOGLE_CLIENT_SECRET = "test-client-secret";
  process.env.GOOGLE_REDIRECT_URI = "http://localhost:3001/api/v1/auth/google/callback";
  process.env.DASHBOARD_URL = "https://dashboard.test";

  ({ app } = await import("../../../app.js"));
  const { initDb } = await import("../../../db/client.js");
  await initDb();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

afterAll(async () => {
  await fs.rm(storageRoot, { recursive: true, force: true });
});

function mockGoogleFetch(userinfo: { sub: string; email: string; email_verified?: boolean }) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string | URL) => {
      const href = url.toString();
      if (href.includes("oauth2.googleapis.com/token")) {
        return new Response(JSON.stringify({ access_token: "fake-access-token" }), { status: 200 });
      }
      if (href.includes("openidconnect.googleapis.com/v1/userinfo")) {
        return new Response(JSON.stringify({ email_verified: true, ...userinfo }), { status: 200 });
      }
      throw new Error(`unexpected fetch to ${href} in test`);
    }),
  );
}

describe("Google OAuth", () => {
  it("GET /auth/google redirects to Google's real authorization endpoint with a signed state", async () => {
    const res = await request(app).get("/api/v1/auth/google");
    expect(res.status).toBe(302);
    const location = new URL(res.headers.location);
    expect(location.hostname).toBe("accounts.google.com");
    expect(location.searchParams.get("client_id")).toBe("test-client-id");
    expect(location.searchParams.get("state")).toBeTruthy();
  });

  it("callback creates a brand-new account for a Google profile never seen before", async () => {
    mockGoogleFetch({ sub: "google-user-1", email: "brand-new@example.test" });

    const authRes = await request(app).get("/api/v1/auth/google");
    const state = new URL(authRes.headers.location).searchParams.get("state")!;

    const callbackRes = await request(app).get("/api/v1/auth/google/callback").query({ code: "fake-code", state });

    expect(callbackRes.status).toBe(302);
    const redirect = new URL(callbackRes.headers.location);
    expect(redirect.origin + redirect.pathname).toBe("https://dashboard.test/auth/callback");
    expect(redirect.hash).toMatch(/^#token=/);

    const meRes = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${decodeURIComponent(redirect.hash.slice("#token=".length))}`);
    expect(meRes.status).toBe(200);
    expect(meRes.body.data.email).toBe("brand-new@example.test");
    expect(meRes.body.data.emailVerified).toBe(true);
  });

  it("links to an existing password account matching the same email, rather than duplicating it", async () => {
    const signupRes = await request(app)
      .post("/api/v1/auth/signup")
      .send({ email: "already-has-password@example.test", password: "correct-horse-battery" });
    const existingUserId = signupRes.body.data.userId;

    mockGoogleFetch({ sub: "google-user-2", email: "already-has-password@example.test" });

    const authRes = await request(app).get("/api/v1/auth/google");
    const state = new URL(authRes.headers.location).searchParams.get("state")!;
    const callbackRes = await request(app).get("/api/v1/auth/google/callback").query({ code: "fake-code", state });

    const redirect = new URL(callbackRes.headers.location);
    const token = decodeURIComponent(redirect.hash.slice("#token=".length));

    const meRes = await request(app).get("/api/v1/auth/me").set("Authorization", `Bearer ${token}`);
    expect(meRes.body.data.userId).toBe(existingUserId); // same account, not a new one
    expect(meRes.body.data.emailVerified).toBe(true); // Google linking marks it verified too
  });

  it("rejects a callback with a missing or invalid state (CSRF protection)", async () => {
    mockGoogleFetch({ sub: "google-user-3", email: "should-not-matter@example.test" });

    const res = await request(app).get("/api/v1/auth/google/callback").query({ code: "fake-code", state: "garbage" });

    expect(res.status).toBe(302);
    const redirect = new URL(res.headers.location);
    expect(redirect.searchParams.get("error")).toBe("google_auth_failed");
  });

  it("rejects a callback with no state at all", async () => {
    mockGoogleFetch({ sub: "google-user-4", email: "still-should-not-matter@example.test" });

    const res = await request(app).get("/api/v1/auth/google/callback").query({ code: "fake-code" });

    expect(res.status).toBe(302);
    expect(new URL(res.headers.location).searchParams.get("error")).toBe("google_auth_failed");
  });
});

describe("Google OAuth — not configured", () => {
  it("GET /auth/google redirects to the dashboard's login page with an error, not a 500", async () => {
    const original = {
      id: process.env.GOOGLE_CLIENT_ID,
      secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect: process.env.GOOGLE_REDIRECT_URI,
    };
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    delete process.env.GOOGLE_REDIRECT_URI;

    vi.resetModules();
    const { app: unconfiguredApp } = await import("../../../app.js");
    const res = await request(unconfiguredApp).get("/api/v1/auth/google");

    expect(res.status).toBe(302);
    expect(new URL(res.headers.location).searchParams.get("error")).toBe("google_not_configured");

    process.env.GOOGLE_CLIENT_ID = original.id;
    process.env.GOOGLE_CLIENT_SECRET = original.secret;
    process.env.GOOGLE_REDIRECT_URI = original.redirect;
  });
});
