import { Router, type Router as ExpressRouter } from "express";
import { z } from "zod";

import { DEFAULT_ENVIRONMENTS } from "../project/service.js";
import { environmentsRepo, releasesRepo } from "../../db/repositories.js";
import { requireSession } from "../../middleware/session.middleware.js";
import { sendSuccess } from "../../shared/responses.js";
import * as projectService from "../project/service.js";

const updateEnvironmentSchema = z.object({
  name: z.string().min(1).max(60).optional(),
  color: z.string().min(1).max(20).optional(),
  description: z.string().max(300).optional(),
});

/**
 * Dashboard-only, session-authed, same ownership-check pattern as devices/routes.ts. "Environment"
 * is presentational metadata (name/color/description) layered on top of the channel mechanism that
 * already does the real work (see package/storage.service.ts) — this router never touches
 * check/download/upload/rollback, only reads/edits the label.
 */
export const environmentsRouter: ExpressRouter = Router({ mergeParams: true });

environmentsRouter.get("/", requireSession, async (req, res, next) => {
  try {
    const { projectId } = req.params as unknown as { projectId: string };
    await projectService.getOwnedProject(req.user!.id, projectId);

    let environments = await environmentsRepo.listByProject(projectId);

    // Lazy backfill: projects created before Environments existed have no rows here yet. Seeding
    // on first read (rather than a one-off migration script) means every project — old or new —
    // just works, with no separate migration step to remember to run.
    if (environments.length === 0) {
      for (const seed of DEFAULT_ENVIRONMENTS) {
        await environmentsRepo.create(projectId, seed.channel, seed.name, seed.color, seed.description);
      }
      environments = await environmentsRepo.listByProject(projectId);
    }

    const withActive = await Promise.all(
      environments.map(async (env) => {
        const [android, ios] = await Promise.all([
          releasesRepo.findActive(projectId, "android", env.channel),
          releasesRepo.findActive(projectId, "ios", env.channel),
        ]);
        return { ...env, active: { android: android ?? null, ios: ios ?? null } };
      }),
    );

    sendSuccess(res, withActive);
  } catch (error) {
    next(error);
  }
});

environmentsRouter.get("/:channel/history", requireSession, async (req, res, next) => {
  try {
    const { projectId, channel } = req.params as unknown as { projectId: string; channel: string };
    await projectService.getOwnedProject(req.user!.id, projectId);

    const platform = typeof req.query.platform === "string" ? req.query.platform : undefined;
    sendSuccess(res, await releasesRepo.listByProject(projectId, platform, channel));
  } catch (error) {
    next(error);
  }
});

environmentsRouter.patch("/:channel", requireSession, async (req, res, next) => {
  try {
    const { projectId, channel } = req.params as unknown as { projectId: string; channel: string };
    await projectService.getOwnedProject(req.user!.id, projectId);

    const body = updateEnvironmentSchema.parse(req.body);
    const updated = await environmentsRepo.update(projectId, channel, body);
    sendSuccess(res, updated ?? null);
  } catch (error) {
    next(error);
  }
});
