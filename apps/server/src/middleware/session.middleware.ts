import type { NextFunction, Request, Response } from "express";

import { readSessionCookie } from "../modules/auth/cookie.js";
import { verifySessionToken } from "../modules/auth/session.js";
import { usersRepo, type UserRow } from "../db/repositories.js";
import { UnauthorizedError } from "../shared/errors.js";

const BEARER = "Bearer ";
const API_KEY_PREFIX = "ota_live_";

/**
 * Resolves the logged-in user from a request by either mechanism, in order:
 *   1. `Authorization: Bearer <sessionToken>` — the token returned in the login/signup response
 *      body. This is what the dashboard uses in production: it and the API are on different
 *      registrable domains (e.g. *.vercel.app vs *.onrender.com), so the session *cookie* is a
 *      third-party cookie that browsers increasingly block regardless of SameSite. A Bearer token
 *      sidesteps that entirely.
 *   2. The `openota_session` cookie — still used for same-origin / self-hosted deployments where a
 *      first-party cookie works fine.
 *
 * A Bearer value starting with `ota_live_` is a *project API key*, not a session token, so it is
 * ignored here (it's handled by requireApiKey instead).
 */
export function resolveSessionUser(req: Request): UserRow | undefined {
  const header = req.header("authorization");
  const bearer = header?.startsWith(BEARER) ? header.slice(BEARER.length) : undefined;
  const rawToken = bearer && !bearer.startsWith(API_KEY_PREFIX) ? bearer : readSessionCookie(req);
  if (!rawToken) {
    return undefined;
  }

  const verified = verifySessionToken(rawToken);
  return verified ? usersRepo.findById(verified.userId) : undefined;
}

/** Dashboard-only auth: requires a valid session (Bearer token or cookie), sets req.user. */
export function requireSession(req: Request, _res: Response, next: NextFunction): void {
  const user = resolveSessionUser(req);
  if (!user) {
    next(new UnauthorizedError("Not logged in"));
    return;
  }

  req.user = user;
  next();
}
