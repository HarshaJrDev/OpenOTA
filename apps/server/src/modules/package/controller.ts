import type { NextFunction, Request, Response } from "express";

import { ValidationError } from "../../shared/errors.js";
import { sendSuccess } from "../../shared/responses.js";
import type { PackageService } from "./service.js";
import {
  checkUpdateQuerySchema,
  packageParamsSchema,
  rollbackSchema,
  uploadPackageSchema,
} from "./validator.js";

export function createPackageController(service: PackageService) {
  async function upload(req: Request, res: Response, next: NextFunction) {
    try {
      const body = uploadPackageSchema.parse(req.body);

      if (!req.file) {
        throw new ValidationError("No file uploaded");
      }

      const manifest = await service.uploadPackage({
        platform: body.platform,
        version: body.version,
        runtimeVersion: body.runtimeVersion,
        bundleName: body.bundleName,
        sha256: body.sha256,
        size: body.size,
        assets: body.assets,
        tempFilePath: req.file.path,
        mimeType: req.file.mimetype,
      });

      sendSuccess(res, manifest, 201);
    } catch (error) {
      next(error);
    }
  }

  async function list(_req: Request, res: Response, next: NextFunction) {
    try {
      const packages = await service.listPackages();
      sendSuccess(res, packages);
    } catch (error) {
      next(error);
    }
  }

  async function checkUpdate(req: Request, res: Response, next: NextFunction) {
    try {
      const query = checkUpdateQuerySchema.parse(req.query);
      const result = await service.checkForUpdate(query.platform, query.currentVersion);
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  async function getOne(req: Request, res: Response, next: NextFunction) {
    try {
      const params = packageParamsSchema.parse(req.params);
      const metadata = await service.getPackage(params.platform, params.version);
      sendSuccess(res, metadata);
    } catch (error) {
      next(error);
    }
  }

  async function download(req: Request, res: Response, next: NextFunction) {
    try {
      const params = packageParamsSchema.parse(req.params);
      const { stream, size } = await service.downloadPackage(params.platform, params.version);

      res.setHeader("Content-Type", "application/zip");
      res.setHeader("Content-Length", size.toString());
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${params.platform}-${params.version}.zip"`,
      );

      stream.on("error", next);
      stream.pipe(res);
    } catch (error) {
      next(error);
    }
  }

  async function remove(req: Request, res: Response, next: NextFunction) {
    try {
      const params = packageParamsSchema.parse(req.params);
      await service.deletePackage(params.platform, params.version);
      sendSuccess(res, { deleted: true });
    } catch (error) {
      next(error);
    }
  }

  async function rollback(req: Request, res: Response, next: NextFunction) {
    try {
      const body = rollbackSchema.parse(req.body);
      const manifest = await service.rollbackToVersion(body.platform, body.version);
      sendSuccess(res, manifest);
    } catch (error) {
      next(error);
    }
  }

  return { upload, list, checkUpdate, getOne, download, remove, rollback };
}

export type PackageController = ReturnType<typeof createPackageController>;
