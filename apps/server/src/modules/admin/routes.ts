import { Router, type Router as ExpressRouter } from "express";
import { z } from "zod";

import { requireAdmin } from "../../middleware/admin.middleware.js";
import { sessionRateLimiter } from "../../middleware/rateLimit.middleware.js";
import { requireSession } from "../../middleware/session.middleware.js";
import { sendSuccess } from "../../shared/responses.js";
import * as adminService from "./service.js";

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
