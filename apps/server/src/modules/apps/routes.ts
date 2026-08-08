import { Router, type Router as ExpressRouter } from "express";
import { z } from "zod";

import { SUPPORTED_PLATFORMS } from "@openota/shared";

import { appConfigsRepo } from "../../db/repositories.js";
import { deviceRateLimiter } from "../../middleware/rateLimit.middleware.js";
import { requireSession } from "../../middleware/session.middleware.js";
import { sendSuccess } from "../../shared/responses.js";
import * as projectService from "../project/service.js";

const platformSchema = z.enum(SUPPORTED_PLATFORMS);

const upsertAppSchema = z.object({
  runtimeVersion: z.string().min(1).optional(),
  // Optional fields are `.nullable()`, not just `.optional()` — the dashboard's "Configure app"
  // form resends every field on every save (not a per-field PATCH), so it needs a way to say
  // "clear this" that's distinct from "wasn't included in this request." `undefined` (key
  // omitted) means leave whatever's already stored alone; explicit `null` means clear it. Before
  // this, clearing an optional field in the dashboard and saving silently kept the old value —
  // indistinguishable from a bug where a save appeared to "roll back" to stale data.
  packageName: z.string().max(200).nullable().optional(),
  bundleIdentifier: z.string().max(200).nullable().optional(),
  minSupportedVersion: z.string().max(50).nullable().optional(),
  // Arbitrary JSON the app can read back at runtime, independent of which OTA bundle is active —
  // see db/client.ts's app_configs.remote_config column doc comment. Validated as an object (not
  // a bare string/array) so /config always hands back something a client can safely spread into
  // its own config shape.
  remoteConfig: z.record(z.string(), z.unknown()).nullable().optional(),
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
    const row = await appConfigsRepo.upsert(projectId, parsedPlatform, {
      ...body,
      remoteConfig: body.remoteConfig === undefined ? undefined : body.remoteConfig === null ? null : JSON.stringify(body.remoteConfig),
    });
    sendSuccess(res, row);
  } catch (error) {
    next(error);
  }
});

/**
 * Public (no session, no API key) — mirrors check/download: a device is never expected to carry a
 * dashboard credential. Rate-limited the same way. Devices poll this independently of OTA.sync(),
 * so a value can change (e.g. which UI variant to render) without shipping a new OTA release at
 * all. Deliberately returns `{}` rather than 404 when nothing's been configured yet, so a client
 * doesn't need special-case error handling for the common "no config set" case.
 */
appsRouter.get("/:platform/config", deviceRateLimiter, async (req, res, next) => {
  try {
    const { projectId, platform } = req.params as unknown as { projectId: string; platform: string };
    const parsedPlatform = platformSchema.parse(platform);
    // The whole point of this endpoint is "the value can change without shipping a new release" —
    // a cached stale response defeats that. No Cache-Control here left this to each HTTP client's
    // own heuristics (Android's OkHttp layer under RN's fetch can and does cache GETs with an
    // ETag but no explicit freshness info), so a device could poll this forever and never see an
    // update. Force no caching, anywhere in the chain.
    res.set("Cache-Control", "no-store");
    const row = await appConfigsRepo.findOne(projectId, parsedPlatform);

    if (!row?.remote_config) {
      sendSuccess(res, {});
      return;
    }

    try {
      sendSuccess(res, JSON.parse(row.remote_config));
    } catch {
      // Stored value somehow isn't valid JSON (shouldn't happen — it's validated on write) —
      // fail soft rather than 500 a device over a config value it can't use anyway.
      sendSuccess(res, {});
    }
  } catch (error) {
    next(error);
  }
});
