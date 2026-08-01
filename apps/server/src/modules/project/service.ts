import { randomBytes } from "node:crypto";

import { environmentsRepo, projectsRepo, type ProjectRow } from "../../db/repositories.js";
import { logger } from "../../config/logger.js";
import type { StorageProvider } from "../../providers/storage/provider.js";
import { NotFoundError } from "../../shared/errors.js";

// A React Native developer's mental model is "prod / staging / dev," not "the flat channel
// namespace" — see docs/CLOUD.md's Channels section. These map 1:1 onto channel strings the
// server/CLI/SDK already understand; this table only adds the label/color/description on top.
export const DEFAULT_ENVIRONMENTS = [
  { channel: "production", name: "Production", color: "green", description: "Live release seen by real users." },
  { channel: "staging", name: "Staging", color: "amber", description: "Pre-release testing." },
  { channel: "development", name: "Development", color: "blue", description: "Internal builds." },
] as const;

async function slugify(name: string): Promise<string> {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

  let slug = base || "project";
  while (await projectsRepo.slugExists(slug)) {
    slug = `${base || "project"}-${randomBytes(3).toString("hex")}`;
  }
  return slug;
}

export async function createProject(ownerId: string, name: string): Promise<ProjectRow> {
  const project = await projectsRepo.create(ownerId, name, await slugify(name));

  for (const env of DEFAULT_ENVIRONMENTS) {
    await environmentsRepo.create(project.id, env.channel, env.name, env.color, env.description);
  }

  return project;
}

export function listProjects(ownerId: string): Promise<ProjectRow[]> {
  return projectsRepo.listByOwner(ownerId);
}

/** Throws NotFoundError rather than returning undefined so callers can't accidentally skip the ownership check. */
export async function getOwnedProject(ownerId: string, projectId: string): Promise<ProjectRow> {
  const project = await projectsRepo.findById(projectId);
  if (!project || project.owner_id !== ownerId) {
    throw new NotFoundError("Project not found");
  }
  return project;
}

/** Renames a project the caller owns. The slug is intentionally left unchanged — it's a stable
 * identifier that may already be referenced elsewhere; only the display name is editable. */
export async function renameProject(ownerId: string, projectId: string, name: string): Promise<ProjectRow> {
  await getOwnedProject(ownerId, projectId); // ownership check (throws NotFound otherwise)
  const updated = await projectsRepo.updateName(projectId, name);
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
  await getOwnedProject(ownerId, projectId); // ownership check
  await projectsRepo.delete(projectId);

  try {
    await storage.delete(`projects/${projectId}`);
  } catch (error) {
    logger.warn({ projectId, err: error }, "project deleted; best-effort storage cleanup failed");
  }
}
