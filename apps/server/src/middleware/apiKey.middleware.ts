import { timingSafeEqual } from "node:crypto";

import type { NextFunction, Request, Response } from "express";

import { env } from "../config/env.js";
import { apiKeysRepo, projectsRepo } from "../db/repositories.js";
import { hashApiKey, isProjectApiKey } from "../modules/apikey/crypto.js";
import { UnauthorizedError } from "../shared/errors.js";
import { resolveSessionUser } from "./session.middleware.js";

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
 * Three coexisting auth modes, tried in order, never overlapping security systems to keep in
 * sync:
 *
 * 1. Project-scoped keys (`ota_live_...`, CLI/CI/device): looked up by prefix, hash-verified in
 *    constant time, rejected if revoked. On success sets `req.project`, which downstream route
 *    handlers (see `requireProjectMatch`) use to enforce that a key for project A can never act
 *    on project B.
 * 2. Dashboard session cookie (browser, first-party): only tried when there's a `:projectId` in
 *    the URL and no valid API key was presented. The dashboard never holds a full API key client-
 *    side (they're shown once, by design — see apikey/service.ts), so it authenticates release
 *    management purely as "this logged-in user owns this project," the same ownership check
 *    `project/service.ts#getOwnedProject` already enforces on the session-only project/api-key
 *    routes. Sets `req.project` exactly like the API-key path, so `requireProjectMatch` and every
 *    downstream handler treat both paths identically.
 * 3. Self-hosted OpenOTA's original single shared secret (`OPENOTA_API_KEY`) — unchanged from
 *    before: no account/org system, one global secret, `req.project` is left `undefined` and
 *    downstream code treats that as "the legacy flat/global namespace". If `OPENOTA_API_KEY` isn't
 *    set, the server runs open on this path (solo developer / already-trusted network).
 *
 * Apply this only to mutating/private routes (upload/rollback/delete/list) — devices reading
 * `check`/download are never expected to carry a server-admin, project, or session secret.
 */
export async function requireApiKey(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const header = req.header("authorization");
    const presented = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : undefined;

    if (presented && isProjectApiKey(presented)) {
      const prefix = presented.slice(0, "ota_live_".length + 8);
      const hashed = hashApiKey(presented);
      const candidates = await apiKeysRepo.findByPrefix(prefix);
      const match = candidates.find((row) => {
        const a = Buffer.from(row.hashed_key);
        const b = Buffer.from(hashed);
        return a.length === b.length && timingSafeEqual(a, b);
      });

      if (!match || match.revoked_at) {
        next(new UnauthorizedError());
        return;
      }

      const project = await projectsRepo.findById(match.project_id);
      if (!project) {
        next(new UnauthorizedError());
        return;
      }

      await apiKeysRepo.touchLastUsed(match.id);
      req.project = project;
      next();
      return;
    }

    // Dashboard session — via a Bearer session token (production, cross-domain) or the session
    // cookie (same-origin). resolveSessionUser ignores `ota_live_` Bearer values, so this never
    // collides with the API-key path above.
    //
    // CSRF note: a Bearer token already forces a CORS preflight (a custom Authorization header is
    // never CORS-safelisted), so a request that presented one is safe as-is regardless of what
    // follows. A request with NO Authorization header at all, if authenticated here, can only be
    // riding the session *cookie* — and in production that cookie is `SameSite=None` (required for
    // the cross-site dashboard, see cookie.ts). This router's upload route takes `multipart/form-
    // data`, a CORS-safelisted "simple" content type browsers send WITHOUT a preflight regardless
    // of CORS_ALLOWED_ORIGINS. Without this check, a malicious site could forge a plain auto-
    // submitting HTML form (no JavaScript, no need to read the response) that uploads an attacker-
    // controlled OTA package to a victim's project purely off their ambient cookie. Requiring this
    // header on the no-Authorization-header path forces a preflight (custom headers are never
    // safelisted either), which then lets CORS_ALLOWED_ORIGINS actually reject the forged request:
    // a forged HTML form cannot add custom headers, and a forged fetch()/XHR from a disallowed
    // origin fails preflight before the browser ever sends the real request.
    const projectId = (req.params as Record<string, string | undefined>).projectId;
    // Scoped to exactly the vulnerable case: a project-scoped route, no Authorization header at
    // all (so the only way this can still authenticate below is the ambient cookie). Flat self-
    // hosted routes never reach here with a projectId, so an operator running fully open
    // (OPENOTA_API_KEY unset) is completely unaffected by this check.
    if (projectId && !presented && req.header("x-requested-with") !== "XMLHttpRequest") {
      next(new UnauthorizedError());
      return;
    }

    if (projectId) {
      const sessionUser = await resolveSessionUser(req);
      if (sessionUser) {
        const project = await projectsRepo.findById(projectId);
        if (project && project.owner_id === sessionUser.id) {
          req.project = project;
          next();
          return;
        }
      }
    }

    if (!env.apiKey) {
      next();
      return;
    }

    if (!presented || !safeEqual(presented, env.apiKey)) {
      next(new UnauthorizedError());
      return;
    }

    next();
  } catch (error) {
    next(error);
  }
}

/** 403s if the authenticated project (see requireApiKey) doesn't match the :projectId route param — the one check that actually enforces cross-tenant isolation on project-scoped routes. */
export function requireProjectMatch(req: Request, _res: Response, next: NextFunction): void {
  if (!req.project || req.project.id !== req.params.projectId) {
    next(new UnauthorizedError());
    return;
  }
  next();
}
