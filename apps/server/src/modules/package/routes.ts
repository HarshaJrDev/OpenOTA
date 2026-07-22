import os from "node:os";

import { Router, type Router as ExpressRouter } from "express";
import multer from "multer";

import { env } from "../../config/env.js";
import { logger } from "../../config/logger.js";
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

packageRouter.post("/", upload.single("file"), packageController.upload);
packageRouter.post("/rollback", packageController.rollback);
packageRouter.get("/check", packageController.checkUpdate);
packageRouter.get("/", packageController.list);
packageRouter.get("/:platform/:version/download", packageController.download);
packageRouter.get("/:platform/:version", packageController.getOne);
packageRouter.delete("/:platform/:version", packageController.remove);
