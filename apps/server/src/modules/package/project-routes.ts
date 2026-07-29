import { Router, type Router as ExpressRouter } from "express";
import multer from "multer";
import os from "node:os";

import { env } from "../../config/env.js";
import { logger } from "../../config/logger.js";
import { requireApiKey, requireProjectMatch } from "../../middleware/apiKey.middleware.js";
import type { StorageProvider } from "../../providers/storage/provider.js";
import { assertSafePathSegment } from "../../shared/utils.js";
import { createPackageController, type PackageController } from "./controller.js";
import { createPackageRepository } from "./repository.js";
import { createPackageService } from "./service.js";
import { createPackageStorageService } from "./storage.service.js";

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

  router.get("/check", (req, res, next) => controllerFor((req.params as unknown as { projectId: string }).projectId).checkUpdate(req, res, next));
  router.get("/:platform/:version/download", (req, res, next) =>
    controllerFor((req.params as unknown as { projectId: string }).projectId).download(req, res, next),
  );
  router.get("/:platform/:version", (req, res, next) => controllerFor((req.params as unknown as { projectId: string }).projectId).getOne(req, res, next));

  return router;
}
