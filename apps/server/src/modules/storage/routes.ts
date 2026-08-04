import { Router, type Router as ExpressRouter } from "express";

import { env } from "../../config/env.js";
import { releasesRepo } from "../../db/repositories.js";
import { sessionRateLimiter } from "../../middleware/rateLimit.middleware.js";
import { requireSession } from "../../middleware/session.middleware.js";
import { createStorageProvider } from "../../providers/storage/index.js";
import { sendSuccess } from "../../shared/responses.js";
import * as projectService from "../project/service.js";

const storageProvider = createStorageProvider();

/** Dashboard-only: surfaces which storage backend this server is running (server-wide config, not per-project) alongside this project's actual usage. Same ownership-check pattern as analytics/devices routes. */
export const storageRouter: ExpressRouter = Router({ mergeParams: true });

storageRouter.use(sessionRateLimiter);

storageRouter.get("/", requireSession, async (req, res, next) => {
  try {
    const { projectId } = req.params as unknown as { projectId: string };
    await projectService.getOwnedProject(req.user!.id, projectId);

    const [{ packageCount, bytesUsed }, healthy] = await Promise.all([
      releasesRepo.storageSummary(projectId),
      // A cheap reachability probe, not a real health endpoint — `list` on a project's own
      // prefix touches the same code path uploads/downloads use, so "healthy" here means
      // "the configured backend is actually reachable with these credentials", not just "the
      // env vars are set" (env.ts already guarantees that much at boot).
      storageProvider
        .list(`projects/${projectId}`)
        .then(() => true)
        .catch(() => false),
    ]);

    sendSuccess(res, {
      provider: env.storageProvider,
      bucket: env.storageProvider === "supabase" ? env.supabaseStorageBucket : null,
      storageRoot: env.storageProvider === "local" ? env.storageRoot : null,
      healthy,
      packageCount,
      bytesUsed,
    });
  } catch (error) {
    next(error);
  }
});
