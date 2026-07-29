import { Router, type Router as ExpressRouter } from "express";
import { z } from "zod";

import { requireSession } from "../../middleware/session.middleware.js";
import { sendSuccess } from "../../shared/responses.js";
import * as projectService from "./service.js";

const createProjectSchema = z.object({ name: z.string().min(1).max(100) });

export const projectRouter: ExpressRouter = Router();

// Deliberately NOT `projectRouter.use(requireSession)`: this router is mounted at
// `/api/v1/projects`, and Express's `app.use()` prefix-matches every sub-path under that mount —
// including `/api/v1/projects/:id/packages/*` and `/api/v1/projects/:id/api-keys/*`, which are
// separate routers with their own auth. A router-wide `.use()` here would run on every one of
// those requests too (and reject them, since they carry a project API key, not a session cookie)
// before Express ever got to try the sibling routers. Applying requireSession per-route instead
// keeps this router's auth scoped to only the routes it actually defines.
projectRouter.post("/", requireSession, (req, res, next) => {
  try {
    const { name } = createProjectSchema.parse(req.body);
    // req.user is guaranteed by requireSession above.
    const project = projectService.createProject(req.user!.id, name);
    sendSuccess(res, project, 201);
  } catch (error) {
    next(error);
  }
});

projectRouter.get("/", requireSession, (req, res, next) => {
  try {
    sendSuccess(res, projectService.listProjects(req.user!.id));
  } catch (error) {
    next(error);
  }
});

projectRouter.get("/:projectId", requireSession, (req, res, next) => {
  try {
    sendSuccess(res, projectService.getOwnedProject(req.user!.id, (req.params as unknown as { projectId: string }).projectId));
  } catch (error) {
    next(error);
  }
});
