import { Router, type Router as ExpressRouter } from "express";
import { z } from "zod";

import { requireApiKey } from "../../middleware/apiKey.middleware.js";
import { requireSession } from "../../middleware/session.middleware.js";
import { createStorageProvider } from "../../providers/storage/index.js";
import { UnauthorizedError } from "../../shared/errors.js";
import { sendSuccess } from "../../shared/responses.js";
import * as projectService from "./service.js";

const projectNameSchema = z.object({ name: z.string().min(1).max(100) });

// One provider instance for this router (used by DELETE for best-effort storage cleanup). Cheap
// to hold: for local storage it's a set of closures over a path; env is validated at boot.
const storage = createStorageProvider();

export const projectRouter: ExpressRouter = Router();

// Deliberately NOT `projectRouter.use(requireSession)`: this router is mounted at
// `/api/v1/projects`, and Express's `app.use()` prefix-matches every sub-path under that mount —
// including `/api/v1/projects/:id/packages/*` and `/api/v1/projects/:id/api-keys/*`, which are
// separate routers with their own auth. A router-wide `.use()` here would run on every one of
// those requests too (and reject them, since they carry a project API key, not a session cookie)
// before Express ever got to try the sibling routers. Applying requireSession per-route instead
// keeps this router's auth scoped to only the routes it actually defines.
projectRouter.post("/", requireSession, async (req, res, next) => {
  try {
    const { name } = projectNameSchema.parse(req.body);
    // req.user is guaranteed by requireSession above.
    const project = await projectService.createProject(req.user!.id, name);
    sendSuccess(res, project, 201);
  } catch (error) {
    next(error);
  }
});

projectRouter.get("/", requireSession, async (req, res, next) => {
  try {
    sendSuccess(res, await projectService.listProjects(req.user!.id));
  } catch (error) {
    next(error);
  }
});

// Mounted BEFORE "/:projectId" so this literal segment wins the match. Lets the CLI resolve
// "which project does this API key belong to" from just the key — no dashboard round-trip needed
// to learn a projectId before `openota init --project-id` can be filled in. Uses requireApiKey
// (not requireSession): a project API key already implies exactly one project server-side; this
// is the one place that fact is exposed back to whoever is holding the key.
projectRouter.get("/me", requireApiKey, (req, res, next) => {
  try {
    if (!req.project) {
      throw new UnauthorizedError(
        "This endpoint requires a project-scoped API key (Authorization: Bearer ota_live_...).",
      );
    }
    sendSuccess(res, req.project);
  } catch (error) {
    next(error);
  }
});

projectRouter.get("/:projectId", requireSession, async (req, res, next) => {
  try {
    sendSuccess(res, await projectService.getOwnedProject(req.user!.id, (req.params as unknown as { projectId: string }).projectId));
  } catch (error) {
    next(error);
  }
});

projectRouter.patch("/:projectId", requireSession, async (req, res, next) => {
  try {
    const { name } = projectNameSchema.parse(req.body);
    const { projectId } = req.params as unknown as { projectId: string };
    sendSuccess(res, await projectService.renameProject(req.user!.id, projectId, name));
  } catch (error) {
    next(error);
  }
});

projectRouter.delete("/:projectId", requireSession, async (req, res, next) => {
  try {
    const { projectId } = req.params as unknown as { projectId: string };
    await projectService.deleteProject(req.user!.id, projectId, storage);
    sendSuccess(res, { deleted: true });
  } catch (error) {
    next(error);
  }
});
