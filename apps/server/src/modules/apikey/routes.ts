import { Router, type Router as ExpressRouter } from "express";
import { z } from "zod";

import { requireSession } from "../../middleware/session.middleware.js";
import { getOwnedProject } from "../project/service.js";
import { sendSuccess } from "../../shared/responses.js";
import * as apiKeyService from "./service.js";

const createKeySchema = z.object({ name: z.string().min(1).max(100) });

// Mounted at /api/v1/projects/:projectId/api-keys — session-authenticated (dashboard), and every
// handler re-verifies req.user owns :projectId before touching that project's keys, so a
// logged-in user can never list/create/revoke another user's project's keys by guessing an id.
export const apiKeyRouter: ExpressRouter = Router({ mergeParams: true });

apiKeyRouter.use(requireSession);

apiKeyRouter.post("/", (req, res, next) => {
  try {
    const { name } = createKeySchema.parse(req.body);
    const project = getOwnedProject(req.user!.id, (req.params as unknown as { projectId: string }).projectId);
    const { key, fullKey } = apiKeyService.createKey(project.id, name);
    // fullKey is returned exactly once, here, and never persisted or logged in plaintext again.
    sendSuccess(res, { ...key, hashed_key: undefined, fullKey }, 201);
  } catch (error) {
    next(error);
  }
});

apiKeyRouter.get("/", (req, res, next) => {
  try {
    const project = getOwnedProject(req.user!.id, (req.params as unknown as { projectId: string }).projectId);
    sendSuccess(res, apiKeyService.listKeys(project.id));
  } catch (error) {
    next(error);
  }
});

apiKeyRouter.delete("/:keyId", (req, res, next) => {
  try {
    const project = getOwnedProject(req.user!.id, (req.params as unknown as { projectId: string }).projectId);
    apiKeyService.revokeKey(project.id, req.params.keyId!);
    sendSuccess(res, { revoked: true });
  } catch (error) {
    next(error);
  }
});
