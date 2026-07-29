import { randomUUID } from "node:crypto";

import { db } from "./client.js";

export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  created_at: string;
}

export interface ProjectRow {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  created_at: string;
  updated_at: string;
}

export interface ApiKeyRow {
  id: string;
  project_id: string;
  name: string;
  prefix: string;
  hashed_key: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

export const usersRepo = {
  create(email: string, passwordHash: string): UserRow {
    const row: UserRow = { id: randomUUID(), email, password_hash: passwordHash, created_at: new Date().toISOString() };
    db.prepare("INSERT INTO users (id, email, password_hash, created_at) VALUES (@id, @email, @password_hash, @created_at)").run(row);
    return row;
  },
  findByEmail(email: string): UserRow | undefined {
    return db.prepare("SELECT * FROM users WHERE email = ?").get(email) as UserRow | undefined;
  },
  findById(id: string): UserRow | undefined {
    return db.prepare("SELECT * FROM users WHERE id = ?").get(id) as UserRow | undefined;
  },
};

export const projectsRepo = {
  create(ownerId: string, name: string, slug: string): ProjectRow {
    const now = new Date().toISOString();
    const row: ProjectRow = { id: randomUUID(), owner_id: ownerId, name, slug, created_at: now, updated_at: now };
    db.prepare(
      "INSERT INTO projects (id, owner_id, name, slug, created_at, updated_at) VALUES (@id, @owner_id, @name, @slug, @created_at, @updated_at)",
    ).run(row);
    return row;
  },
  findById(id: string): ProjectRow | undefined {
    return db.prepare("SELECT * FROM projects WHERE id = ?").get(id) as ProjectRow | undefined;
  },
  listByOwner(ownerId: string): ProjectRow[] {
    return db.prepare("SELECT * FROM projects WHERE owner_id = ? ORDER BY created_at DESC").all(ownerId) as ProjectRow[];
  },
  slugExists(slug: string): boolean {
    return db.prepare("SELECT 1 FROM projects WHERE slug = ?").get(slug) !== undefined;
  },
};

export const apiKeysRepo = {
  create(projectId: string, name: string, prefix: string, hashedKey: string): ApiKeyRow {
    const row: ApiKeyRow = {
      id: randomUUID(),
      project_id: projectId,
      name,
      prefix,
      hashed_key: hashedKey,
      created_at: new Date().toISOString(),
      last_used_at: null,
      revoked_at: null,
    };
    db.prepare(
      "INSERT INTO api_keys (id, project_id, name, prefix, hashed_key, created_at, last_used_at, revoked_at) VALUES (@id, @project_id, @name, @prefix, @hashed_key, @created_at, @last_used_at, @revoked_at)",
    ).run(row);
    return row;
  },
  findByPrefix(prefix: string): ApiKeyRow[] {
    return db.prepare("SELECT * FROM api_keys WHERE prefix = ?").all(prefix) as ApiKeyRow[];
  },
  listByProject(projectId: string): ApiKeyRow[] {
    return db.prepare("SELECT * FROM api_keys WHERE project_id = ? ORDER BY created_at DESC").all(projectId) as ApiKeyRow[];
  },
  findById(id: string): ApiKeyRow | undefined {
    return db.prepare("SELECT * FROM api_keys WHERE id = ?").get(id) as ApiKeyRow | undefined;
  },
  touchLastUsed(id: string): void {
    db.prepare("UPDATE api_keys SET last_used_at = ? WHERE id = ?").run(new Date().toISOString(), id);
  },
  revoke(id: string): void {
    db.prepare("UPDATE api_keys SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL").run(new Date().toISOString(), id);
  },
};
