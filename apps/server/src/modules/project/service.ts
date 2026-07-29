import { randomBytes } from "node:crypto";

import { projectsRepo, type ProjectRow } from "../../db/repositories.js";
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
