import os from "node:os";

import { Router, type Router as ExpressRouter } from "express";
import multer from "multer";

import { env } from "../../config/env.js";
import { logger } from "../../config/logger.js";
import { requireApiKey } from "../../middleware/apiKey.middleware.js";
import { deviceRateLimiter } from "../../middleware/rateLimit.middleware.js";
import { createStorageProvider } from "../../providers/storage/index.js";
import { createPackageController } from "./controller.js";
import { createPackageRepository } from "./repository.js";
import { createPackageService } from "./service.js";
import { createPackageStorageService } from "./storage.service.js";

const storageProvider = createStorageProvider();
const packageStorageService = createPackageStorageService(storageProvider);
const packageRepository = createPackageRepository(packageStorageService);
const packageService = createPackageService(packageRepository, logger);
const packageController = createPackageController(packageService);

const upload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: env.maxPackageSizeBytes },
});

export const packageRouter: ExpressRouter = Router();

// Mutating routes require OPENOTA_API_KEY when configured (see apiKey.middleware.ts) — check/
// list/download stay open since devices consuming updates are never expected to carry a
// server-admin secret.
packageRouter.post("/", requireApiKey, upload.single("file"), packageController.upload);
packageRouter.post("/rollback", requireApiKey, packageController.rollback);
packageRouter.get("/check", deviceRateLimiter, packageController.checkUpdate);
packageRouter.get("/", packageController.list);
packageRouter.get("/:platform/:version/download", deviceRateLimiter, packageController.download);
packageRouter.get("/:platform/:version", packageController.getOne);
packageRouter.delete("/:platform/:version", requireApiKey, packageController.remove);
