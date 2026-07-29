import type { NextFunction, Request, Response } from "express";

import { readSessionCookie } from "../modules/auth/cookie.js";
import { verifySessionToken } from "../modules/auth/session.js";
import { usersRepo } from "../db/repositories.js";
import { UnauthorizedError } from "../shared/errors.js";

/** Dashboard-only auth: requires a valid signed session cookie, sets req.user. */
export function requireSession(req: Request, _res: Response, next: NextFunction): void {
  const token = readSessionCookie(req);
  const verified = token ? verifySessionToken(token) : null;

  if (!verified) {
    next(new UnauthorizedError("Not logged in"));
    return;
  }

  const user = usersRepo.findById(verified.userId);
  if (!user) {
    next(new UnauthorizedError("Not logged in"));
    return;
  }

  req.user = user;
  next();
}
