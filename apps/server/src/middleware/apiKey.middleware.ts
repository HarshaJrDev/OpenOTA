import { timingSafeEqual } from "node:crypto";

import type { NextFunction, Request, Response } from "express";

import { env } from "../config/env.js";
import { UnauthorizedError } from "../shared/errors.js";

/** Constant-time comparison — a plain `!==` short-circuits on the first mismatched byte, which
 * leaks how many leading characters of a guess were correct via response timing. Lengths differing
 * is not itself sensitive (the key isn't secret-length-hidden anywhere else either), so comparing
 * that first with `!==` before the constant-time check is fine. */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

/**
 * Self-hosted OpenOTA has no account/org system — this is a single shared secret, not a
 * per-user credential store. If OPENOTA_API_KEY isn't set, the server runs open (a solo
 * developer or a deployment already behind a private network/VPN doesn't need this); if it is
 * set, every request through this middleware must present it as `Authorization: Bearer <key>`.
 * Apply this only to mutating routes (upload/rollback/delete) — devices reading `check`/download
 * are never expected to carry a server-admin secret.
 */
export function requireApiKey(req: Request, _res: Response, next: NextFunction): void {
  if (!env.apiKey) {
    next();
    return;
  }

  const header = req.header("authorization");
  const presented = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : undefined;

  if (!presented || !safeEqual(presented, env.apiKey)) {
    next(new UnauthorizedError());
    return;
  }

  next();
}
