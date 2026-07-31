import { randomUUID } from "node:crypto";

import { query } from "./client.js";

export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  email_verified: boolean;
  created_at: string;
}

export interface AuthTokenRow {
  id: string;
  user_id: string;
  purpose: "verify_email" | "reset_password";
  token_hash: string;
  expires_at: string;
  used_at: string | null;
  created_at: string;
}

export interface DeviceCheckinRow {
  id: string;
  project_id: string;
  device_id: string;
  platform: string;
  app_version: string;
  runtime_version: string;
  download_count: number;
  first_seen_at: string;
  last_seen_at: string;
}

export type InstallResultStatus = "success" | "failure" | "rollback";

export interface InstallResultRow {
  id: string;
  project_id: string;
  device_id: string;
  platform: string;
  version: string;
  runtime_version: string;
  status: InstallResultStatus;
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
    const row: UserRow = {
      id: randomUUID(),
      email,
      password_hash: passwordHash,
      email_verified: false,
      created_at: new Date().toISOString(),
    };
    await query(
      "INSERT INTO users (id, email, password_hash, email_verified, created_at) VALUES ($1, $2, $3, $4, $5)",
      [row.id, row.email, row.password_hash, row.email_verified, row.created_at],
    );
    return row;
  },
  async findByEmail(email: string): Promise<UserRow | undefined> {
    return one(await query<UserRow>("SELECT * FROM users WHERE email = $1", [email]));
  },
  async findById(id: string): Promise<UserRow | undefined> {
    return one(await query<UserRow>("SELECT * FROM users WHERE id = $1", [id]));
  },
  async markEmailVerified(id: string): Promise<void> {
    await query("UPDATE users SET email_verified = TRUE WHERE id = $1", [id]);
  },
  async updatePassword(id: string, passwordHash: string): Promise<void> {
    await query("UPDATE users SET password_hash = $1 WHERE id = $2", [passwordHash, id]);
  },
};

export const authTokensRepo = {
  async create(userId: string, purpose: AuthTokenRow["purpose"], tokenHash: string, expiresAt: string): Promise<AuthTokenRow> {
    const row: AuthTokenRow = {
      id: randomUUID(),
      user_id: userId,
      purpose,
      token_hash: tokenHash,
      expires_at: expiresAt,
      used_at: null,
      created_at: new Date().toISOString(),
    };
    await query(
      "INSERT INTO auth_tokens (id, user_id, purpose, token_hash, expires_at, used_at, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)",
      [row.id, row.user_id, row.purpose, row.token_hash, row.expires_at, row.used_at, row.created_at],
    );
    return row;
  },
  /** Unused tokens for a user+purpose, newest first — callers compare the hash themselves. */
  async findActiveByUser(userId: string, purpose: AuthTokenRow["purpose"]): Promise<AuthTokenRow[]> {
    return query<AuthTokenRow>(
      "SELECT * FROM auth_tokens WHERE user_id = $1 AND purpose = $2 AND used_at IS NULL ORDER BY created_at DESC",
      [userId, purpose],
    );
  },
  async markUsed(id: string): Promise<void> {
    await query("UPDATE auth_tokens SET used_at = $1 WHERE id = $2", [new Date().toISOString(), id]);
  },
};

export const deviceCheckinsRepo = {
  /** Upserts the per-device "last seen" row; increments download_count only when `isDownload`. */
  async record(params: {
    projectId: string;
    deviceId: string;
    platform: string;
    appVersion: string;
    runtimeVersion: string;
    isDownload: boolean;
  }): Promise<void> {
    const now = new Date().toISOString();
    await query(
      `INSERT INTO device_checkins (id, project_id, device_id, platform, app_version, runtime_version, download_count, first_seen_at, last_seen_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
       ON CONFLICT (project_id, device_id) DO UPDATE SET
         platform = EXCLUDED.platform,
         app_version = EXCLUDED.app_version,
         runtime_version = EXCLUDED.runtime_version,
         download_count = device_checkins.download_count + EXCLUDED.download_count,
         last_seen_at = EXCLUDED.last_seen_at`,
      [
        randomUUID(),
        params.projectId,
        params.deviceId,
        params.platform,
        params.appVersion,
        params.runtimeVersion,
        params.isDownload ? 1 : 0,
        now,
      ],
    );
  },
  async listByProject(projectId: string): Promise<DeviceCheckinRow[]> {
    return query<DeviceCheckinRow>(
      "SELECT * FROM device_checkins WHERE project_id = $1 ORDER BY last_seen_at DESC",
      [projectId],
    );
  },
};

export const installResultsRepo = {
  async record(params: {
    projectId: string;
    deviceId: string;
    platform: string;
    version: string;
    runtimeVersion: string;
    status: InstallResultStatus;
  }): Promise<void> {
    await query(
      `INSERT INTO install_results (id, project_id, device_id, platform, version, runtime_version, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        randomUUID(),
        params.projectId,
        params.deviceId,
        params.platform,
        params.version,
        params.runtimeVersion,
        params.status,
        new Date().toISOString(),
      ],
    );
  },
  /** Counts by status — exactly what Analytics' Installs/Failures/Rollbacks stat cards need. */
  async countsByProject(projectId: string): Promise<Record<InstallResultStatus, number>> {
    const rows = await query<{ status: InstallResultStatus; count: string }>(
      "SELECT status, COUNT(*) as count FROM install_results WHERE project_id = $1 GROUP BY status",
      [projectId],
    );
    const counts: Record<InstallResultStatus, number> = { success: 0, failure: 0, rollback: 0 };
    for (const row of rows) {
      counts[row.status] = Number(row.count);
    }
    return counts;
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
