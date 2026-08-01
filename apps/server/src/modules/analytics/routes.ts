import { Router, type Router as ExpressRouter } from "express";
import { z } from "zod";

import { deviceCheckinsRepo, installResultsRepo, releasesRepo } from "../../db/repositories.js";
import { requireSession } from "../../middleware/session.middleware.js";
import { sendSuccess } from "../../shared/responses.js";
import * as projectService from "../project/service.js";

const releaseStatsParamsSchema = z.object({
  platform: z.enum(["android", "ios"]),
  version: z.string().min(1),
});

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

/** Per-release drill-in for the release detail page: install outcomes, live devices, and which channels currently point at it. */
analyticsRouter.get("/releases/:platform/:version", requireSession, async (req, res, next) => {
  try {
    const { projectId } = req.params as unknown as { projectId: string };
    await projectService.getOwnedProject(req.user!.id, projectId);
    const { platform, version } = releaseStatsParamsSchema.parse(req.params);

    const [installCounts, devicesOnVersion, channels] = await Promise.all([
      installResultsRepo.countsByVersion(projectId, platform, version),
      deviceCheckinsRepo.countOnVersion(projectId, platform, version),
      releasesRepo.findByVersion(projectId, platform, version),
    ]);

    sendSuccess(res, { installCounts, devicesOnVersion, channels });
  } catch (error) {
    next(error);
  }
});
