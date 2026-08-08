import { Router, type Router as ExpressRouter } from "express";
import { z } from "zod";

import { apiKeysRepo, deploymentEventsRepo, type DeploymentEventType } from "../../db/repositories.js";
import { sessionRateLimiter } from "../../middleware/rateLimit.middleware.js";
import { requireSession } from "../../middleware/session.middleware.js";
import { sendSuccess } from "../../shared/responses.js";
import * as projectService from "../project/service.js";

const EVENT_TYPES = ["release", "rollback", "rollout_change"] as const satisfies readonly DeploymentEventType[];
const MAX_LIMIT = 200;

const logsQuerySchema = z.object({
  platform: z.enum(["android", "ios"]).optional(),
  channel: z.string().min(1).max(60).optional(),
  eventType: z.enum(EVENT_TYPES).optional(),
  limit: z.coerce.number().int().positive().max(MAX_LIMIT).default(100),
});

/**
 * Dashboard-only, project-wide activity log — every release/rollback/rollout_change across every
 * platform and channel for one project, real deployment_events rows, nothing fabricated. This is
 * NOT the server's own stdout request/error logging (Pino) — that's ephemeral and was never
 * queryable via the REST API; the dashboard's /logs page is explicit about that distinction. This
 * is the "Audit Logs" surface: what actually changed, when, and (where known) by which API key.
 */
export const logsRouter: ExpressRouter = Router({ mergeParams: true });

logsRouter.use(sessionRateLimiter);

logsRouter.get("/", requireSession, async (req, res, next) => {
  try {
    const { projectId } = req.params as unknown as { projectId: string };
    await projectService.getOwnedProject(req.user!.id, projectId);

    const query = logsQuerySchema.parse(req.query);
    const events = await deploymentEventsRepo.listByProject(projectId, query);

    // Resolve api_key actor IDs to their (revocable, human-chosen) names in one batch — an
    // actor_id the operator has since revoked/deleted still resolves to null gracefully rather
    // than breaking the whole response; the log entry just shows "API key" with no name.
    const apiKeyIds = [...new Set(events.filter((e) => e.actor_type === "api_key" && e.actor_id).map((e) => e.actor_id!))];
    const apiKeyNames = new Map<string, string>();
    await Promise.all(
      apiKeyIds.map(async (id) => {
        const key = await apiKeysRepo.findById(id);
        if (key) apiKeyNames.set(id, key.name);
      }),
    );

    const enriched = events.map((event) => ({
      ...event,
      actor_name: event.actor_type === "api_key" && event.actor_id ? (apiKeyNames.get(event.actor_id) ?? null) : null,
    }));

    sendSuccess(res, enriched);
  } catch (error) {
    next(error);
  }
});
