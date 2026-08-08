import { Router, type Router as ExpressRouter } from "express";
import { z } from "zod";

import { pageViewsRepo } from "../../db/repositories.js";
import { requireAdmin } from "../../middleware/admin.middleware.js";
import { deviceRateLimiter, sessionRateLimiter } from "../../middleware/rateLimit.middleware.js";
import { requireSession, resolveSessionUser } from "../../middleware/session.middleware.js";
import { sendSuccess } from "../../shared/responses.js";

const APPS = ["docs", "dashboard"] as const;

const trackSchema = z.object({
  app: z.enum(APPS),
  path: z.string().min(1).max(500),
  referrer: z.string().max(500).nullable().optional(),
  visitorId: z.string().min(8).max(100),
});

/**
 * Anonymous, public, first-party pageview beacon — no auth, since it fires from the marketing
 * site's own visitors and from the dashboard's logged-out pages (login/signup) as well as its
 * logged-in ones. `deviceRateLimiter`'s budget (120/min/IP) is reused deliberately: same threat
 * model as device check-ins — public, high-frequency-by-design, throttled only against abuse.
 * `userId` is attached only when a real session cookie is present, never trusted from the body —
 * a client claiming someone else's user id must not be able to attribute a fake view to them.
 */
export const trafficTrackRouter: ExpressRouter = Router();

trafficTrackRouter.post("/track", deviceRateLimiter, async (req, res, next) => {
  try {
    const body = trackSchema.parse(req.body);
    const user = await resolveSessionUser(req).catch(() => undefined);
    await pageViewsRepo.record({
      app: body.app,
      path: body.path,
      referrer: body.referrer ?? null,
      visitorId: body.visitorId,
      userId: user?.id ?? null,
    });
    sendSuccess(res, { recorded: true }, 202);
  } catch (error) {
    next(error);
  }
});

const rangeSchema = z.object({
  app: z.enum(APPS),
  // "7d" | "30d" | "90d" — kept as a small closed set rather than an arbitrary date range, since
  // this is a single admin panel, not a general-purpose query API.
  range: z.enum(["7d", "30d", "90d"]).default("30d"),
});

const RANGE_DAYS: Record<string, number> = { "7d": 7, "30d": 30, "90d": 90 };

/** Admin-only real traffic numbers — see admin/page.tsx's Traffic panel. No mocked/seeded rows. */
export const trafficAdminRouter: ExpressRouter = Router();

trafficAdminRouter.use(sessionRateLimiter, requireSession, requireAdmin);

trafficAdminRouter.get("/", async (req, res, next) => {
  try {
    const { app, range } = rangeSchema.parse(req.query);
    const since = new Date(Date.now() - (RANGE_DAYS[range] ?? 30) * 24 * 60 * 60 * 1000).toISOString();

    const [summary, daily, topPaths] = await Promise.all([
      pageViewsRepo.summary(app, since),
      pageViewsRepo.dailyCounts(app, since),
      pageViewsRepo.topPaths(app, since, 10),
    ]);

    sendSuccess(res, { app, range, ...summary, daily, topPaths });
  } catch (error) {
    next(error);
  }
});
