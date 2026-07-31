import { Router, type Router as ExpressRouter } from "express";

import { installResultsRepo } from "../../db/repositories.js";
import { requireSession } from "../../middleware/session.middleware.js";
import { sendSuccess } from "../../shared/responses.js";
import * as projectService from "../project/service.js";

/** Dashboard-only aggregate counts — same ownership-check pattern as devices/routes.ts. */
export const analyticsRouter: ExpressRouter = Router({ mergeParams: true });

analyticsRouter.get("/install-results", requireSession, async (req, res, next) => {
  try {
    const { projectId } = req.params as unknown as { projectId: string };
    await projectService.getOwnedProject(req.user!.id, projectId);
    sendSuccess(res, await installResultsRepo.countsByProject(projectId));
  } catch (error) {
    next(error);
  }
});
