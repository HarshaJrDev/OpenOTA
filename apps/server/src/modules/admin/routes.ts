import { Router, type Router as ExpressRouter } from "express";
import { z } from "zod";

import { requireAdmin } from "../../middleware/admin.middleware.js";
import { sessionRateLimiter } from "../../middleware/rateLimit.middleware.js";
import { requireSession } from "../../middleware/session.middleware.js";
import { sendSuccess } from "../../shared/responses.js";
import * as adminService from "./service.js";
import { getDatabaseStatus, getDomainStatus, getEmailStatus, getStorageStatus } from "./infrastructure.service.js";

const updateSettingsSchema = z.object({ emailTestMode: z.boolean() });

export const adminRouter: ExpressRouter = Router();

adminRouter.use(sessionRateLimiter, requireSession, requireAdmin);

adminRouter.get("/settings", async (_req, res, next) => {
  try {
    sendSuccess(res, { emailTestMode: await adminService.getEmailTestMode() });
  } catch (error) {
    next(error);
  }
});

adminRouter.patch("/settings", async (req, res, next) => {
  try {
    const { emailTestMode } = updateSettingsSchema.parse(req.body);
    await adminService.setEmailTestMode(emailTestMode);
    sendSuccess(res, { emailTestMode });
  } catch (error) {
    next(error);
  }
});

/**
 * Read-only infrastructure status — see infrastructure.service.ts's doc comment for why this is
 * never a "save new config" endpoint. Admin-gated (same as every /admin/* route) since even
 * masked config (host names, which provider) is more than an ordinary user needs to see.
 */
adminRouter.get("/infrastructure", async (_req, res, next) => {
  try {
    const [database, storage, email] = await Promise.all([
      getDatabaseStatus(),
      getStorageStatus(),
      getEmailStatus(await adminService.getEmailTestMode()),
    ]);
    sendSuccess(res, { database, storage, email, domain: getDomainStatus() });
  } catch (error) {
    next(error);
  }
});
