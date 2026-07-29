import fs from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";

import { env } from "../config/env.js";

/**
 * A single embedded SQLite file is the entire multi-tenant data layer (users/projects/api
 * keys/releases) — OTA package bytes/manifests still live entirely in `StorageProvider`, this DB
 * only tracks ownership/auth metadata. SQLite is deliberately chosen over a hosted RDBMS for v0.1:
 * a self-hoster gets multi-tenancy with zero extra infrastructure (one file, backed up like any
 * other), and `DATABASE_URL` stays the escape hatch name so a future Postgres driver swap (for
 * OpenOTA Cloud at real scale) only touches this file, never callers.
 */
const dbPath = env.databaseUrl.startsWith("file:")
  ? path.resolve(env.databaseUrl.slice("file:".length))
  : env.databaseUrl;

if (dbPath !== ":memory:") {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
}

export const db: Database.Database = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

/**
 * Idempotent schema bootstrap, run once at process start — deliberately not a migration framework
 * (see the plan note on scope): v0.1 has no schema history to migrate yet, and `CREATE TABLE IF NOT
 * EXISTS` is sufficient until the schema needs its first real breaking change.
 */
export function initSchema(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id            TEXT PRIMARY KEY,
      email         TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at    TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS projects (
      id         TEXT PRIMARY KEY,
      owner_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name       TEXT NOT NULL,
      slug       TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_projects_owner ON projects(owner_id);

    CREATE TABLE IF NOT EXISTS app_configs (
      id              TEXT PRIMARY KEY,
      project_id      TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      platform        TEXT NOT NULL,
      runtime_version TEXT NOT NULL,
      created_at      TEXT NOT NULL,
      UNIQUE (project_id, platform, runtime_version)
    );

    CREATE TABLE IF NOT EXISTS api_keys (
      id           TEXT PRIMARY KEY,
      project_id   TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      name         TEXT NOT NULL,
      prefix       TEXT NOT NULL,
      hashed_key   TEXT NOT NULL,
      created_at   TEXT NOT NULL,
      last_used_at TEXT,
      revoked_at   TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_api_keys_prefix ON api_keys(prefix);
    CREATE INDEX IF NOT EXISTS idx_api_keys_project ON api_keys(project_id);

    CREATE TABLE IF NOT EXISTS releases (
      id              TEXT PRIMARY KEY,
      project_id      TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      platform        TEXT NOT NULL,
      channel         TEXT NOT NULL DEFAULT 'production',
      version         TEXT NOT NULL,
      runtime_version TEXT NOT NULL,
      storage_key     TEXT NOT NULL,
      checksum        TEXT NOT NULL,
      size_bytes      INTEGER NOT NULL,
      status          TEXT NOT NULL DEFAULT 'active',
      created_at      TEXT NOT NULL,
      created_by      TEXT REFERENCES api_keys(id),
      UNIQUE (project_id, platform, channel, version)
    );
    CREATE INDEX IF NOT EXISTS idx_releases_lookup ON releases(project_id, platform, channel, runtime_version, status);
  `);
}
