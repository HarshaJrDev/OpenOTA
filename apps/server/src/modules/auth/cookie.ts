import type { Request, Response } from "express";

export const SESSION_COOKIE_NAME = "openota_session";
const MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 days, mirrors session.ts's SESSION_TTL_MS

/**
 * The session cookie's cross-site attributes. In production the dashboard (e.g. *.vercel.app) and
 * the API (e.g. *.onrender.com) are different sites, so the browser will only store/return the
 * cookie on a credentialed cross-site fetch if it is `SameSite=None; Secure` — `SameSite=Lax`
 * (the safe default for a same-site app) is silently dropped cross-site, which manifests as
 * "login succeeds but the session never persists". Locally the dashboard and API are both
 * `localhost` (same site), so `Lax` works and avoids requiring HTTPS for the `Secure` attribute
 * that `SameSite=None` mandates. Override with SESSION_COOKIE_CROSS_SITE=true/false if your
 * deployment topology differs (e.g. same-origin reverse proxy in prod, or cross-site in dev).
 */
function cookieAttributes(): string {
  const explicit = process.env.SESSION_COOKIE_CROSS_SITE;
  const crossSite = explicit ? explicit === "true" : process.env.NODE_ENV === "production";
  return crossSite ? "SameSite=None; Secure" : "SameSite=Lax";
}

/** Minimal manual cookie read/write for the one first-party session cookie — not worth a dependency for this. */
export function readSessionCookie(req: Request): string | undefined {
  const header = req.headers.cookie;
  if (!header) {
    return undefined;
  }

  for (const part of header.split(";")) {
    const [rawName, ...rawValue] = part.trim().split("=");
    if (rawName === SESSION_COOKIE_NAME) {
      return decodeURIComponent(rawValue.join("="));
    }
  }

  return undefined;
}

export function setSessionCookie(res: Response, token: string): void {
  res.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}; HttpOnly; ${cookieAttributes()}; Path=/; Max-Age=${MAX_AGE_SECONDS}`,
  );
}

export function clearSessionCookie(res: Response): void {
  // Must carry the same SameSite/Secure attributes as when set, or some browsers refuse the clear.
  res.setHeader("Set-Cookie", `${SESSION_COOKIE_NAME}=; HttpOnly; ${cookieAttributes()}; Path=/; Max-Age=0`);
}
