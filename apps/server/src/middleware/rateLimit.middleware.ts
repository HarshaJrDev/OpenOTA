import rateLimit from "express-rate-limit";

import { TooManyRequestsError } from "../shared/errors.js";

/**
 * Brute-force protection for the credential endpoints (login/signup). These are the only routes
 * where an attacker can guess a secret (a password) unboundedly, so they get a strict per-IP
 * budget. Upload/rollback are already gated by a high-entropy API key and a size cap, and
 * device-facing check/download are meant to be hit frequently, so those are deliberately not
 * throttled here (a global limiter would harm legitimate device polling more than it helps).
 *
 * Fixed 15-minute window, 10 attempts per IP. Emits the app's standard error envelope + a 429 so
 * clients get a consistent `{ success:false, error }` shape rather than express-rate-limit's
 * default plain-text body. `req.ip` is only trustworthy because app.ts sets `trust proxy` for the
 * single Render/PaaS proxy hop — without that, every request would share the proxy's IP.
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  // The test suite drives many signup/login calls from a single loopback IP; rate-limiting those
  // would make tests flaky without exercising any real behavior. This disables only the throttle,
  // never the auth checks themselves, and only under NODE_ENV=test.
  skip: () => process.env.NODE_ENV === "test",
  handler: (_req, _res, next) => {
    next(new TooManyRequestsError("Too many attempts. Please wait a few minutes and try again."));
  },
});

/**
 * A generous per-IP budget on check/download/report — these are meant to be hit frequently by
 * real devices (every app launch, every background check), so this exists purely to blunt abuse
 * (scraping, a misbehaving client polling in a tight loop) rather than throttle normal use. Many
 * real devices can legitimately share one IP (corporate NAT, carrier-grade NAT on mobile), so the
 * budget is per-minute and high, not the tight per-15-minutes window auth uses.
 */
export const deviceRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === "test",
  handler: (_req, _res, next) => {
    next(new TooManyRequestsError("Too many requests. Please slow down and try again shortly."));
  },
});

/**
 * Defense-in-depth for the session/API-key-authenticated dashboard surface (admin, projects,
 * api-keys, environments, devices, analytics, storage) — previously none of these had any
 * throttle at all. Auth is the real gate here, not this limiter; the point is bounding the blast
 * radius if a session or bearer token is ever stolen (or a logged-in-but-malicious user scripts
 * abuse), not protecting a secret-guessing surface the way authRateLimiter does. Generous budget
 * (a real dashboard page load can legitimately fire a handful of parallel requests) and a short
 * window, per IP.
 */
export const sessionRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === "test",
  handler: (_req, _res, next) => {
    next(new TooManyRequestsError("Too many requests. Please slow down and try again shortly."));
  },
});
