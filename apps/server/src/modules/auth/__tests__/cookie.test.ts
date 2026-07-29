import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { clearSessionCookie, setSessionCookie } from "../cookie.js";

/** Minimal Response stand-in that just records the Set-Cookie header. */
function fakeRes() {
  const headers: Record<string, string> = {};
  return {
    setHeader: (name: string, value: string) => {
      headers[name.toLowerCase()] = value;
    },
    cookie: () => headers["set-cookie"],
  } as const;
}

describe("session cookie cross-site attributes", () => {
  const original = { NODE_ENV: process.env.NODE_ENV, override: process.env.SESSION_COOKIE_CROSS_SITE };

  beforeEach(() => {
    delete process.env.SESSION_COOKIE_CROSS_SITE;
  });

  afterEach(() => {
    process.env.NODE_ENV = original.NODE_ENV;
    if (original.override === undefined) delete process.env.SESSION_COOKIE_CROSS_SITE;
    else process.env.SESSION_COOKIE_CROSS_SITE = original.override;
    vi.restoreAllMocks();
  });

  it("uses SameSite=Lax without Secure in development (same-site localhost)", () => {
    process.env.NODE_ENV = "development";
    const res = fakeRes();
    setSessionCookie(res as never, "tok");
    expect(res.cookie()).toContain("SameSite=Lax");
    expect(res.cookie()).not.toContain("Secure");
    expect(res.cookie()).toContain("HttpOnly");
  });

  it("uses SameSite=None; Secure in production (cross-site Vercel<->Render)", () => {
    process.env.NODE_ENV = "production";
    const res = fakeRes();
    setSessionCookie(res as never, "tok");
    // This is the exact fix for 'login succeeds but session never persists' cross-site: a Lax
    // cookie is silently dropped by the browser on a credentialed cross-site fetch.
    expect(res.cookie()).toContain("SameSite=None");
    expect(res.cookie()).toContain("Secure");
  });

  it("honors the SESSION_COOKIE_CROSS_SITE override regardless of NODE_ENV", () => {
    process.env.NODE_ENV = "development";
    process.env.SESSION_COOKIE_CROSS_SITE = "true";
    const res = fakeRes();
    setSessionCookie(res as never, "tok");
    expect(res.cookie()).toContain("SameSite=None");
    expect(res.cookie()).toContain("Secure");
  });

  it("clears the cookie with matching attributes (some browsers reject a mismatched clear)", () => {
    process.env.NODE_ENV = "production";
    const res = fakeRes();
    clearSessionCookie(res as never);
    expect(res.cookie()).toContain("SameSite=None");
    expect(res.cookie()).toContain("Secure");
    expect(res.cookie()).toContain("Max-Age=0");
  });
});
