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

export interface AppConfigRow {
  id: string;
  project_id: string;
  platform: string;
  runtime_version: string;
  package_name: string | null;
  bundle_identifier: string | null;
  min_supported_version: string | null;
  created_at: string;
  updated_at: string | null;
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

export type ReleaseStatus = "active" | "inactive" | "rolled_back";

export interface ReleaseRow {
  id: string;
  project_id: string;
  platform: string;
  channel: string;
  version: string;
  runtime_version: string;
  storage_key: string;
  checksum: string;
  size_bytes: number;
  status: ReleaseStatus;
  created_at: string;
  created_by: string | null;
  release_notes: string | null;
  rollback_reason: string | null;
  rollout_percentage: number;
}

export interface EnvironmentRow {
  id: string;
  project_id: string;
  channel: string;
  name: string;
  color: string;
  description: string | null;
  created_at: string;
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

  /**
   * Devices currently reporting this exact version as their `app_version` — a live count, not a
   * download total (a device that later moved on no longer counts here). Used by the release
   * detail page's "Devices on this version" stat.
   */
  async countOnVersion(projectId: string, platform: string, appVersion: string): Promise<number> {
    const rows = await query<{ count: string }>(
      "SELECT COUNT(*) as count FROM device_checkins WHERE project_id = $1 AND platform = $2 AND app_version = $3",
      [projectId, platform, appVersion],
    );
    return Number(rows[0]?.count ?? 0);
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

  /** Same shape as countsByProject, scoped to one release — the release detail page's install outcome breakdown. */
  async countsByVersion(projectId: string, platform: string, version: string): Promise<Record<InstallResultStatus, number>> {
    const rows = await query<{ status: InstallResultStatus; count: string }>(
      "SELECT status, COUNT(*) as count FROM install_results WHERE project_id = $1 AND platform = $2 AND version = $3 GROUP BY status",
      [projectId, platform, version],
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

export const appConfigsRepo = {
  async listByProject(projectId: string): Promise<AppConfigRow[]> {
    return query<AppConfigRow>("SELECT * FROM app_configs WHERE project_id = $1 ORDER BY platform ASC", [projectId]);
  },

  async findOne(projectId: string, platform: string): Promise<AppConfigRow | undefined> {
    return one(
      await query<AppConfigRow>("SELECT * FROM app_configs WHERE project_id = $1 AND platform = $2", [projectId, platform]),
    );
  },

  /** Upsert on (project_id, platform) — the dashboard's "Configure app" form calls this whether or not a row exists yet. */
  async upsert(
    projectId: string,
    platform: string,
    fields: { runtimeVersion?: string; packageName?: string; bundleIdentifier?: string; minSupportedVersion?: string },
  ): Promise<AppConfigRow> {
    const existing = await this.findOne(projectId, platform);
    const now = new Date().toISOString();

    if (!existing) {
      const row: AppConfigRow = {
        id: randomUUID(),
        project_id: projectId,
        platform,
        runtime_version: fields.runtimeVersion ?? "1.0.0",
        package_name: fields.packageName ?? null,
        bundle_identifier: fields.bundleIdentifier ?? null,
        min_supported_version: fields.minSupportedVersion ?? null,
        created_at: now,
        updated_at: now,
      };
      await query(
        `INSERT INTO app_configs (id, project_id, platform, runtime_version, package_name, bundle_identifier, min_supported_version, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [row.id, row.project_id, row.platform, row.runtime_version, row.package_name, row.bundle_identifier, row.min_supported_version, row.created_at, row.updated_at],
      );
      return row;
    }

    const updated: AppConfigRow = {
      ...existing,
      runtime_version: fields.runtimeVersion ?? existing.runtime_version,
      package_name: fields.packageName ?? existing.package_name,
      bundle_identifier: fields.bundleIdentifier ?? existing.bundle_identifier,
      min_supported_version: fields.minSupportedVersion ?? existing.min_supported_version,
      updated_at: now,
    };
    await query(
      "UPDATE app_configs SET runtime_version = $1, package_name = $2, bundle_identifier = $3, min_supported_version = $4, updated_at = $5 WHERE id = $6",
      [updated.runtime_version, updated.package_name, updated.bundle_identifier, updated.min_supported_version, updated.updated_at, existing.id],
    );
    return updated;
  },
};

export const releasesRepo = {
  /**
   * One call per upload/rollback event — see package/service.ts. Marks whatever was previously
   * `active` for this (project, platform, channel) as `newStatus` (superseded on a fresh upload,
   * rolled_back on a rollback), then either flips an existing row for `version` back to `active`
   * (the rollback-to-a-prior-version case) or inserts a brand new one (a genuinely new upload).
   */
  async recordActivation(params: {
    projectId: string;
    platform: string;
    channel: string;
    version: string;
    runtimeVersion: string;
    storageKey: string;
    checksum: string;
    sizeBytes: number;
    createdBy: string | null;
    releaseNotes?: string | null;
    rollbackReason?: string | null;
    previousStatus: "inactive" | "rolled_back";
  }): Promise<void> {
    const now = new Date().toISOString();

    await query(
      "UPDATE releases SET status = $1 WHERE project_id = $2 AND platform = $3 AND channel = $4 AND status = 'active'",
      [params.previousStatus, params.projectId, params.platform, params.channel],
    );

    const existing = await query<ReleaseRow>(
      "SELECT * FROM releases WHERE project_id = $1 AND platform = $2 AND channel = $3 AND version = $4",
      [params.projectId, params.platform, params.channel, params.version],
    );

    if (existing.length > 0) {
      await query(
        "UPDATE releases SET status = 'active', rollback_reason = COALESCE($1, rollback_reason) WHERE id = $2",
        [params.rollbackReason ?? null, existing[0]!.id],
      );
      return;
    }

    await query(
      `INSERT INTO releases (id, project_id, platform, channel, version, runtime_version, storage_key, checksum, size_bytes, status, created_at, created_by, release_notes, rollback_reason)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'active', $10, $11, $12, $13)`,
      [
        randomUUID(),
        params.projectId,
        params.platform,
        params.channel,
        params.version,
        params.runtimeVersion,
        params.storageKey,
        params.checksum,
        params.sizeBytes,
        now,
        params.createdBy,
        params.releaseNotes ?? null,
        params.rollbackReason ?? null,
      ],
    );
  },

  async listByProject(projectId: string, platform?: string, channel?: string): Promise<ReleaseRow[]> {
    const conditions = ["project_id = $1"];
    const params: unknown[] = [projectId];

    if (platform) {
      params.push(platform);
      conditions.push(`platform = $${params.length}`);
    }
    if (channel) {
      params.push(channel);
      conditions.push(`channel = $${params.length}`);
    }

    return query<ReleaseRow>(
      `SELECT * FROM releases WHERE ${conditions.join(" AND ")} ORDER BY created_at DESC`,
      params,
    );
  },

  async findActive(projectId: string, platform: string, channel: string): Promise<ReleaseRow | undefined> {
    return one(
      await query<ReleaseRow>(
        "SELECT * FROM releases WHERE project_id = $1 AND platform = $2 AND channel = $3 AND status = 'active'",
        [projectId, platform, channel],
      ),
    );
  },

  /** Every channel row for one exact (platform, version) — the release detail page's "live on" list, including past/superseded activations. */
  async findByVersion(projectId: string, platform: string, version: string): Promise<ReleaseRow[]> {
    return query<ReleaseRow>(
      "SELECT * FROM releases WHERE project_id = $1 AND platform = $2 AND version = $3 ORDER BY created_at DESC",
      [projectId, platform, version],
    );
  },

  /** Adjusts exposure on the currently-active release only — a no-op (returns undefined) if there's no active release yet. */
  async setRolloutPercentage(
    projectId: string,
    platform: string,
    channel: string,
    percentage: number,
  ): Promise<ReleaseRow | undefined> {
    await query(
      "UPDATE releases SET rollout_percentage = $1 WHERE project_id = $2 AND platform = $3 AND channel = $4 AND status = 'active'",
      [percentage, projectId, platform, channel],
    );
    return this.findActive(projectId, platform, channel);
  },
};

export const environmentsRepo = {
  async create(projectId: string, channel: string, name: string, color: string, description?: string): Promise<EnvironmentRow> {
    const row: EnvironmentRow = {
      id: randomUUID(),
      project_id: projectId,
      channel,
      name,
      color,
      description: description ?? null,
      created_at: new Date().toISOString(),
    };
    await query(
      "INSERT INTO environments (id, project_id, channel, name, color, description, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)",
      [row.id, row.project_id, row.channel, row.name, row.color, row.description, row.created_at],
    );
    return row;
  },
  async listByProject(projectId: string): Promise<EnvironmentRow[]> {
    return query<EnvironmentRow>("SELECT * FROM environments WHERE project_id = $1 ORDER BY created_at ASC", [projectId]);
  },
  async update(projectId: string, channel: string, fields: { name?: string; color?: string; description?: string }): Promise<EnvironmentRow | undefined> {
    const existing = one(await query<EnvironmentRow>("SELECT * FROM environments WHERE project_id = $1 AND channel = $2", [projectId, channel]));
    const row = await existing;
    if (!row) {
      return undefined;
    }
    const name = fields.name ?? row.name;
    const color = fields.color ?? row.color;
    const description = fields.description ?? row.description;
    await query("UPDATE environments SET name = $1, color = $2, description = $3 WHERE id = $4", [name, color, description, row.id]);
    return { ...row, name, color, description };
  },
};

export const settingsRepo = {
  async get(key: string): Promise<string | undefined> {
    const row = one(await query<{ value: string }>("SELECT value FROM settings WHERE key = $1", [key]));
    return (await row)?.value;
  },
  async set(key: string, value: string): Promise<void> {
    await query(
      "INSERT INTO settings (key, value, updated_at) VALUES ($1, $2, $3) ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = $3",
      [key, value, new Date().toISOString()],
    );
  },
};
