import { Router, type Router as ExpressRouter } from "express";
import multer from "multer";
import os from "node:os";
import { z } from "zod";

import { env } from "../../config/env.js";
import { logger } from "../../config/logger.js";
import { deviceCheckinsRepo, installResultsRepo } from "../../db/repositories.js";
import { requireApiKey, requireProjectMatch } from "../../middleware/apiKey.middleware.js";
import type { StorageProvider } from "../../providers/storage/provider.js";
import { sendSuccess } from "../../shared/responses.js";
import { assertSafePathSegment } from "../../shared/utils.js";
import { createPackageController, type PackageController } from "./controller.js";
import { createPackageRepository } from "./repository.js";
import { createPackageService } from "./service.js";
import { createPackageStorageService } from "./storage.service.js";

const reportInstallResultSchema = z.object({
  deviceId: z.string().min(1),
  platform: z.string().min(1),
  version: z.string().min(1),
  runtimeVersion: z.string().min(1),
  status: z.enum(["success", "failure", "rollback"]),
});

/**
 * Fire-and-forget device check-in write — never awaited by the caller, never allowed to affect
 * the actual check/download response. `deviceId` is optional (older SDKs, or self-hosted apps
 * that never upgrade) so this silently no-ops rather than requiring it.
 */
function recordDeviceCheckin(
  projectId: string,
  params: { deviceId?: unknown; platform?: unknown; appVersion?: unknown; runtimeVersion?: unknown; isDownload: boolean },
): void {
  const { deviceId, platform, appVersion, runtimeVersion, isDownload } = params;
  if (typeof deviceId !== "string" || typeof platform !== "string" || typeof appVersion !== "string") {
    return;
  }
  void deviceCheckinsRepo
    .record({
      projectId,
      deviceId,
      platform,
      appVersion,
      runtimeVersion: typeof runtimeVersion === "string" ? runtimeVersion : "unknown",
      isDownload,
    })
    .catch((error) => logger.error({ error, projectId, deviceId }, "failed to record device check-in"));
}

const upload = multer({ dest: os.tmpdir(), limits: { fileSize: env.maxPackageSizeBytes } });

/**
 * Project-scoped counterpart of `routes.ts`'s flat router. Reuses the exact same
 * controller/service/repository/storage-service factories — only the storage key prefix differs
 * (`projects/{projectId}`, taken from the URL's own `:projectId` param, validated as a safe path
 * segment the same way `platform`/`version` already are — never anything else client-supplied) —
 * so upload/check/download/rollback business logic is not duplicated or forked between
 * single-tenant and multi-tenant modes.
 *
 * Auth posture mirrors the flat router exactly: mutating routes (upload/rollback/delete/list)
 * require a project API key AND that key's project must match `:projectId` (requireProjectMatch)
 * — this is the actual cross-tenant isolation boundary. Device-facing reads (check/download/
 * getOne) stay open, same as the flat router's devices-carry-no-secret design; isolation there
 * comes from the URL's `:projectId` itself scoping which storage prefix is read, not from a secret.
 */
export function createProjectPackageRouter(storageProvider: StorageProvider): ExpressRouter {
  const router: ExpressRouter = Router({ mergeParams: true });

  function controllerFor(projectId: string): PackageController {
    assertSafePathSegment(projectId);
    const storageKeyPrefix = `projects/${projectId}`;
    const packageStorageService = createPackageStorageService(storageProvider, storageKeyPrefix);
    const packageRepository = createPackageRepository(packageStorageService);
    const packageService = createPackageService(packageRepository, logger);
    return createPackageController(packageService);
  }

  router.post("/", requireApiKey, requireProjectMatch, upload.single("file"), (req, res, next) =>
    controllerFor((req.params as unknown as { projectId: string }).projectId).upload(req, res, next),
  );
  router.post("/rollback", requireApiKey, requireProjectMatch, (req, res, next) =>
    controllerFor((req.params as unknown as { projectId: string }).projectId).rollback(req, res, next),
  );
  router.delete("/:platform/:version", requireApiKey, requireProjectMatch, (req, res, next) =>
    controllerFor((req.params as unknown as { projectId: string }).projectId).remove(req, res, next),
  );
  router.get("/", requireApiKey, requireProjectMatch, (req, res, next) =>
    controllerFor((req.params as unknown as { projectId: string }).projectId).list(req, res, next),
  );

  router.get("/check", (req, res, next) => {
    const { projectId } = req.params as unknown as { projectId: string };
    recordDeviceCheckin(projectId, {
      deviceId: req.query.deviceId,
      platform: req.query.platform,
      appVersion: req.query.currentVersion,
      runtimeVersion: req.query.runtimeVersion,
      isDownload: false,
    });
    return controllerFor(projectId).checkUpdate(req, res, next);
  });
  router.get("/:platform/:version/download", (req, res, next) => {
    const { projectId, platform, version } = req.params as unknown as {
      projectId: string;
      platform: string;
      version: string;
    };
    recordDeviceCheckin(projectId, {
      deviceId: req.query.deviceId,
      platform,
      appVersion: version,
      runtimeVersion: req.query.runtimeVersion,
      isDownload: true,
    });
    return controllerFor(projectId).download(req, res, next);
  });
  router.get("/:platform/:version", (req, res, next) => controllerFor((req.params as unknown as { projectId: string }).projectId).getOne(req, res, next));

  // Device-facing, open (same posture as check/download — no secret, isolation comes from
  // :projectId itself). This is the SDK's own signal, after it observes the native runtime's
  // post-activate/rollback state — the server has no independent way to know an install outcome.
  router.post("/report", async (req, res, next) => {
    try {
      const { projectId } = req.params as unknown as { projectId: string };
      const body = reportInstallResultSchema.parse(req.body);
      await installResultsRepo.record({
        projectId,
        deviceId: body.deviceId,
        platform: body.platform,
        version: body.version,
        runtimeVersion: body.runtimeVersion,
        status: body.status,
      });
      sendSuccess(res, { recorded: true });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
