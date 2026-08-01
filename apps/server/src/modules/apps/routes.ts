import { Router, type Router as ExpressRouter } from "express";
import { z } from "zod";

import { SUPPORTED_PLATFORMS } from "@openota/shared";

import { appConfigsRepo } from "../../db/repositories.js";
import { requireSession } from "../../middleware/session.middleware.js";
import { sendSuccess } from "../../shared/responses.js";
import * as projectService from "../project/service.js";

const platformSchema = z.enum(SUPPORTED_PLATFORMS);

const upsertAppSchema = z.object({
  runtimeVersion: z.string().min(1).optional(),
  packageName: z.string().max(200).optional(),
  bundleIdentifier: z.string().max(200).optional(),
  minSupportedVersion: z.string().max(50).optional(),
});

/**
 * "App" in the dashboard's RN-developer vocabulary is a per-(project, platform) settings record
 * (package name, bundle identifier, runtime version, min supported version) — display/config
 * metadata layered on top of the platform strings that already flow through check/upload/rollback.
 * Session-authed, dashboard-only, same ownership-check pattern as devices/environments routes.
 */
export const appsRouter: ExpressRouter = Router({ mergeParams: true });

appsRouter.get("/", requireSession, async (req, res, next) => {
  try {
    const { projectId } = req.params as unknown as { projectId: string };
    await projectService.getOwnedProject(req.user!.id, projectId);
    sendSuccess(res, await appConfigsRepo.listByProject(projectId));
  } catch (error) {
    next(error);
  }
});

appsRouter.put("/:platform", requireSession, async (req, res, next) => {
  try {
    const { projectId, platform } = req.params as unknown as { projectId: string; platform: string };
    await projectService.getOwnedProject(req.user!.id, projectId);
    const parsedPlatform = platformSchema.parse(platform);
    const body = upsertAppSchema.parse(req.body);
    sendSuccess(res, await appConfigsRepo.upsert(projectId, parsedPlatform, body));
  } catch (error) {
    next(error);
  }
});
