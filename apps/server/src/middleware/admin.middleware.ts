import type { NextFunction, Request, Response } from "express";

import { env } from "../config/env.js";
import { UnauthorizedError } from "../shared/errors.js";

/**
 * Must run after `requireSession` (needs `req.user`). Admin status is env-controlled
 * (ADMIN_EMAILS), not a DB column — see env.ts's doc comment on why. Reuses the same
 * UnauthorizedError as everywhere else so a non-admin can't distinguish "not logged in" from
 * "logged in but not an admin" from the response shape alone.
 */
export function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  const email = req.user?.email.toLowerCase();
  if (!email || !env.adminEmails.has(email)) {
    next(new UnauthorizedError());
    return;
  }
  next();
}
