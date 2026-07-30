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
