import { Router, type Router as ExpressRouter } from "express";

import { deviceCheckinsRepo } from "../../db/repositories.js";
import { sessionRateLimiter } from "../../middleware/rateLimit.middleware.js";
import { requireSession } from "../../middleware/session.middleware.js";
import { sendSuccess } from "../../shared/responses.js";
import * as projectService from "../project/service.js";

/**
 * Dashboard-only read of the device_checkins registry — never device-facing (devices never
 * authenticate, so this can't use requireApiKey; it's the operator viewing their own project).
 * Ownership is checked the same way project/routes.ts checks it: getOwnedProject throws if the
 * session user doesn't own :projectId, which is the actual isolation boundary here.
 */
export const devicesRouter: ExpressRouter = Router({ mergeParams: true });

devicesRouter.use(sessionRateLimiter);

devicesRouter.get("/", requireSession, async (req, res, next) => {
  try {
    const { projectId } = req.params as unknown as { projectId: string };
    await projectService.getOwnedProject(req.user!.id, projectId);
    sendSuccess(res, await deviceCheckinsRepo.listByProject(projectId));
  } catch (error) {
    next(error);
  }
});
