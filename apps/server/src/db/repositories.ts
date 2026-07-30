import { randomUUID } from "node:crypto";

import { query } from "./client.js";

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

async function one<T>(rows: T[]): Promise<T | undefined> {
  return rows[0];
}

export const usersRepo = {
  async create(email: string, passwordHash: string): Promise<UserRow> {
    const row: UserRow = { id: randomUUID(), email, password_hash: passwordHash, created_at: new Date().toISOString() };
    await query(
      "INSERT INTO users (id, email, password_hash, created_at) VALUES ($1, $2, $3, $4)",
      [row.id, row.email, row.password_hash, row.created_at],
    );
    return row;
  },
  async findByEmail(email: string): Promise<UserRow | undefined> {
    return one(await query<UserRow>("SELECT * FROM users WHERE email = $1", [email]));
  },
  async findById(id: string): Promise<UserRow | undefined> {
    return one(await query<UserRow>("SELECT * FROM users WHERE id = $1", [id]));
  },
};

export const projectsRepo = {
  async create(ownerId: string, name: string, slug: string): Promise<ProjectRow> {
    const now = new Date().toISOString();
    const row: ProjectRow = { id: randomUUID(), owner_id: ownerId, name, slug, created_at: now, updated_at: now };
    await query(
      "INSERT INTO projects (id, owner_id, name, slug, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6)",
      [row.id, row.owner_id, row.name, row.slug, row.created_at, row.updated_at],
    );
    return row;
  },
  async findById(id: string): Promise<ProjectRow | undefined> {
    return one(await query<ProjectRow>("SELECT * FROM projects WHERE id = $1", [id]));
  },
  async listByOwner(ownerId: string): Promise<ProjectRow[]> {
    return query<ProjectRow>("SELECT * FROM projects WHERE owner_id = $1 ORDER BY created_at DESC", [ownerId]);
  },
  async slugExists(slug: string): Promise<boolean> {
    return (await query("SELECT 1 FROM projects WHERE slug = $1", [slug])).length > 0;
  },
  async updateName(id: string, name: string): Promise<ProjectRow | undefined> {
    await query("UPDATE projects SET name = $1, updated_at = $2 WHERE id = $3", [name, new Date().toISOString(), id]);
    return this.findById(id);
  },
  // FK cascade (schema: ON DELETE CASCADE) removes the project's app_configs, api_keys and
  // releases in the same statement — Postgres enforces this natively, no PRAGMA needed.
  async delete(id: string): Promise<void> {
    await query("DELETE FROM projects WHERE id = $1", [id]);
  },
};

export const apiKeysRepo = {
  async create(projectId: string, name: string, prefix: string, hashedKey: string): Promise<ApiKeyRow> {
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
    await query(
      "INSERT INTO api_keys (id, project_id, name, prefix, hashed_key, created_at, last_used_at, revoked_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
      [row.id, row.project_id, row.name, row.prefix, row.hashed_key, row.created_at, row.last_used_at, row.revoked_at],
    );
    return row;
  },
  async findByPrefix(prefix: string): Promise<ApiKeyRow[]> {
    return query<ApiKeyRow>("SELECT * FROM api_keys WHERE prefix = $1", [prefix]);
  },
  async listByProject(projectId: string): Promise<ApiKeyRow[]> {
    return query<ApiKeyRow>("SELECT * FROM api_keys WHERE project_id = $1 ORDER BY created_at DESC", [projectId]);
  },
  async findById(id: string): Promise<ApiKeyRow | undefined> {
    return one(await query<ApiKeyRow>("SELECT * FROM api_keys WHERE id = $1", [id]));
  },
  async touchLastUsed(id: string): Promise<void> {
    await query("UPDATE api_keys SET last_used_at = $1 WHERE id = $2", [new Date().toISOString(), id]);
  },
  async revoke(id: string): Promise<void> {
    await query("UPDATE api_keys SET revoked_at = $1 WHERE id = $2 AND revoked_at IS NULL", [new Date().toISOString(), id]);
  },
};
