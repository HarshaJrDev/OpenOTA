import { randomBytes } from "node:crypto";

import { projectsRepo, type ProjectRow } from "../../db/repositories.js";
import { logger } from "../../config/logger.js";
import type { StorageProvider } from "../../providers/storage/provider.js";
import { NotFoundError } from "../../shared/errors.js";

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

  let slug = base || "project";
  while (projectsRepo.slugExists(slug)) {
    slug = `${base || "project"}-${randomBytes(3).toString("hex")}`;
  }
  return slug;
}

export function createProject(ownerId: string, name: string): ProjectRow {
  return projectsRepo.create(ownerId, name, slugify(name));
}

export function listProjects(ownerId: string): ProjectRow[] {
  return projectsRepo.listByOwner(ownerId);
}

/** Throws NotFoundError rather than returning undefined so callers can't accidentally skip the ownership check. */
export function getOwnedProject(ownerId: string, projectId: string): ProjectRow {
  const project = projectsRepo.findById(projectId);
  if (!project || project.owner_id !== ownerId) {
    throw new NotFoundError("Project not found");
  }
  return project;
}

/** Renames a project the caller owns. The slug is intentionally left unchanged — it's a stable
 * identifier that may already be referenced elsewhere; only the display name is editable. */
export function renameProject(ownerId: string, projectId: string, name: string): ProjectRow {
  getOwnedProject(ownerId, projectId); // ownership check (throws NotFound otherwise)
  const updated = projectsRepo.updateName(projectId, name);
  if (!updated) {
    throw new NotFoundError("Project not found");
  }
  return updated;
}

/**
 * Deletes a project the caller owns. The DB row is the authoritative record — removing it (with FK
 * cascade) makes the project and all its api-keys/releases metadata instantly inaccessible via
 * every route. Storage bytes are then cleaned up best-effort: on the local provider a recursive
 * remove of `projects/{id}` clears everything; on object stores this deletes the prefix marker but
 * may leave nested release objects orphaned (harmless, unreferenced disk use — a future background
 * sweep can reclaim it). A storage failure never fails the delete, since the metadata is already
 * gone and re-running would just 404.
 */
export async function deleteProject(
  ownerId: string,
  projectId: string,
  storage: StorageProvider,
): Promise<void> {
  getOwnedProject(ownerId, projectId); // ownership check
  projectsRepo.delete(projectId);

  try {
    await storage.delete(`projects/${projectId}`);
  } catch (error) {
    logger.warn({ projectId, err: error }, "project deleted; best-effort storage cleanup failed");
  }
}
