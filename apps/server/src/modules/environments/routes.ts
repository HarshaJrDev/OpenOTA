import { Router, type Router as ExpressRouter } from "express";
import { z } from "zod";

import { DEFAULT_ENVIRONMENTS } from "../project/service.js";
import { deploymentEventsRepo, environmentsRepo, releasesRepo } from "../../db/repositories.js";
import { keyFor, liveRegistry, notifyReleaseChange } from "../live/registry.js";
import { sessionRateLimiter } from "../../middleware/rateLimit.middleware.js";
import { requireSession } from "../../middleware/session.middleware.js";
import { sendSuccess } from "../../shared/responses.js";
import * as projectService from "../project/service.js";

const updateEnvironmentSchema = z.object({
  name: z.string().min(1).max(60).optional(),
  color: z.string().min(1).max(20).optional(),
  description: z.string().max(300).optional(),
});

const updateRolloutSchema = z.object({
  platform: z.enum(["android", "ios"]),
  percentage: z.number().int().min(0).max(100),
});

/**
 * Dashboard-only, session-authed, same ownership-check pattern as devices/routes.ts. "Environment"
 * is presentational metadata (name/color/description) layered on top of the channel mechanism that
 * already does the real work (see package/storage.service.ts) — this router never touches
 * check/download/upload/rollback, only reads/edits the label.
 */
export const environmentsRouter: ExpressRouter = Router({ mergeParams: true });

environmentsRouter.use(sessionRateLimiter);

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

environmentsRouter.get("/:channel/live-count", requireSession, async (req, res, next) => {
  try {
    const { projectId, channel } = req.params as unknown as { projectId: string; channel: string };
    await projectService.getOwnedProject(req.user!.id, projectId);

    const platform = typeof req.query.platform === "string" ? req.query.platform : undefined;

    if (platform) {
      sendSuccess(res, { count: liveRegistry.countFor(keyFor(projectId, platform, channel)) });
      return;
    }

    const android = liveRegistry.countFor(keyFor(projectId, "android", channel));
    const ios = liveRegistry.countFor(keyFor(projectId, "ios", channel));
    sendSuccess(res, { count: android + ios, android, ios });
  } catch (error) {
    next(error);
  }
});

environmentsRouter.get("/:channel/history", requireSession, async (req, res, next) => {
  try {
    const { projectId, channel } = req.params as unknown as { projectId: string; channel: string };
    await projectService.getOwnedProject(req.user!.id, projectId);

    const platform = typeof req.query.platform === "string" ? req.query.platform : undefined;
    const releases = await releasesRepo.listByProject(projectId, platform, channel);
    const releaseNotesByVersion = new Map(releases.map((release) => [release.version, release.release_notes]));

    type Entry = {
      id: string;
      event_type: "release" | "rollback" | "rollout_change";
      version: string;
      runtime_version: string | null;
      rollout_percentage: number | null;
      previous_rollout_percentage: number | null;
      release_notes: string | null;
      reason: string | null;
      created_at: string;
    };

    let entries: Entry[];

    if (platform) {
      // deployment_events is the authoritative, full-fidelity timeline (one entry per action, not
      // per version — a version rolled back to twice shows as two entries here) but only exists
      // going forward from when this table was added. releases-table rows fill in for whatever
      // predates that: any version with at least one real event is fully represented by its
      // events, so only versions with *no* events fall back to a single releases-row-derived entry.
      const events = await deploymentEventsRepo.listByChannel(projectId, platform, channel);
      const versionsWithEvents = new Set(events.map((event) => event.version));

      const eventEntries: Entry[] = events.map((event) => ({
        id: event.id,
        event_type: event.event_type,
        version: event.version,
        runtime_version: event.runtime_version,
        rollout_percentage: event.rollout_percentage,
        previous_rollout_percentage: event.previous_rollout_percentage,
        release_notes: event.event_type === "rollout_change" ? null : (releaseNotesByVersion.get(event.version) ?? null),
        reason: event.reason,
        created_at: event.created_at,
      }));

      const legacyEntries: Entry[] = releases
        .filter((release) => !versionsWithEvents.has(release.version))
        .map((release) => ({
          id: release.id,
          event_type: release.status === "rolled_back" ? "rollback" : "release",
          version: release.version,
          runtime_version: release.runtime_version,
          rollout_percentage: null,
          previous_rollout_percentage: null,
          release_notes: release.release_notes,
          reason: release.rollback_reason,
          created_at: release.created_at,
        }));

      entries = [...eventEntries, ...legacyEntries];
    } else {
      entries = releases.map((release) => ({
        id: release.id,
        event_type: release.status === "rolled_back" ? "rollback" : "release",
        version: release.version,
        runtime_version: release.runtime_version,
        rollout_percentage: null,
        previous_rollout_percentage: null,
        release_notes: release.release_notes,
        reason: release.rollback_reason,
        created_at: release.created_at,
      }));
    }

    entries.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    sendSuccess(res, entries);
  } catch (error) {
    next(error);
  }
});

environmentsRouter.patch("/:channel/rollout", requireSession, async (req, res, next) => {
  try {
    const { projectId, channel } = req.params as unknown as { projectId: string; channel: string };
    await projectService.getOwnedProject(req.user!.id, projectId);

    const { platform, percentage } = updateRolloutSchema.parse(req.body);
    const updated = await releasesRepo.setRolloutPercentage(projectId, platform, channel, percentage, req.user!.id);
    void notifyReleaseChange(projectId, platform, channel);
    sendSuccess(res, updated ?? null);
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
