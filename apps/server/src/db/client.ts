import fs from "node:fs";
import path from "node:path";

import { PGlite } from "@electric-sql/pglite";
import pg from "pg";

import { env } from "../config/env.js";

/**
 * One async query interface over two Postgres backends, chosen by DATABASE_URL:
 *
 *   - `postgres://…` / `postgresql://…`  → real Postgres via `pg` (this is Supabase in production).
 *   - anything else / unset               → PGlite, an embedded in-process Postgres (WASM). Used
 *     for tests (in-memory) and for local dev / self-hosting with no external database (persisted
 *     to a directory). Same SQL dialect as production, so there is real dev/prod parity and the
 *     repositories are written once.
 *
 * Both `pg.Pool.query` and `PGlite.query` return `{ rows }` for `(text, params)`, so callers use
 * the single `query()` export below and never learn which backend is active.
 */
type QueryResult<T> = { rows: T[] };
interface Db {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<QueryResult<T>>;
  /** Runs one or more `;`-separated statements with no parameters (used only for schema bootstrap).
   * PGlite's parametrized `query()` rejects multi-statement SQL, so this is a distinct path. */
  exec(text: string): Promise<void>;
}

function isPostgresUrl(url: string | undefined): boolean {
  return !!url && (url.startsWith("postgres://") || url.startsWith("postgresql://"));
}

let db: Db;

function createDb(): Db {
  const url = env.databaseUrl;

  if (isPostgresUrl(url)) {
    // Supabase (and most managed Postgres) require TLS. `rejectUnauthorized: false` accepts their
    // certificate chain without shipping a CA bundle; the connection is still encrypted.
    const pool = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });
    return {
      query: (text, params) => pool.query(text, params) as never,
      exec: async (text) => {
        await pool.query(text); // node-postgres runs multiple statements when there are no params
      },
    };
  }

  // PGlite. `memory://` for tests (never touches disk, isolated per run); a directory otherwise so
  // local/self-hosted data persists across restarts.
  let dataDir: string;
  if (env.nodeEnv === "test") {
    dataDir = "memory://";
  } else {
    const fromUrl = url?.startsWith("file:") ? url.slice("file:".length) : undefined;
    dataDir = fromUrl ? path.resolve(fromUrl) : path.resolve(process.cwd(), "data/pgdata");
    fs.mkdirSync(dataDir, { recursive: true });
  }
  const pglite = new PGlite(dataDir);
  return {
    query: (text, params) => pglite.query(text, params) as never,
    exec: async (text) => {
      await pglite.exec(text);
    },
  };
}

/** Idempotent schema bootstrap. Async because both backends connect lazily on first query. */
export async function initDb(): Promise<void> {
  db = createDb();
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id              TEXT PRIMARY KEY,
      email           TEXT NOT NULL UNIQUE,
      password_hash   TEXT,
      email_verified  BOOLEAN NOT NULL DEFAULT FALSE,
      created_at      TEXT NOT NULL
    );
    -- CREATE TABLE IF NOT EXISTS is a no-op on a table that already exists in production (real
    -- Supabase data predating this column) — it does NOT retroactively add new columns. Every
    -- column added to an existing table after its initial release needs its own idempotent
    -- ALTER TABLE here, since there is no separate migration runner.
    ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE;
    -- A Google-only account has no password — nullable so auth/google.ts's createFromGoogle can
    -- insert without one. Every password-path write (signup, reset-password) still always sets a
    -- real hash; only Google-created rows ever have NULL here.
    ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
    -- NULL for password-only accounts; set (and unique) once an account signs in with Google —
    -- either a fresh Google signup or linked onto an existing password account by matching email
    -- (see auth/google.ts's account-linking rule).
    ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id TEXT UNIQUE;

    -- Single-use, expiring tokens for both email verification and password reset. One table
    -- (distinguished by "purpose") rather than two -- same shape, same lifecycle, same repo methods.
    CREATE TABLE IF NOT EXISTS auth_tokens (
      id         TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      purpose    TEXT NOT NULL, -- 'verify_email' | 'reset_password'
      token_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      used_at    TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_auth_tokens_user ON auth_tokens(user_id, purpose);

    CREATE TABLE IF NOT EXISTS projects (
      id         TEXT PRIMARY KEY,
      owner_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name       TEXT NOT NULL,
      slug       TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_projects_owner ON projects(owner_id);

    -- "App" in the dashboard's RN-developer-facing vocabulary — one row per (project, platform).
    -- runtime_version here is a *default/display* value, not an enforced constraint (actual
    -- compatibility gating stays entirely native-side, unchanged — see docs/GETTING_STARTED.md).
    CREATE TABLE IF NOT EXISTS app_configs (
      id              TEXT PRIMARY KEY,
      project_id      TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      platform        TEXT NOT NULL,
      runtime_version TEXT NOT NULL,
      created_at      TEXT NOT NULL,
      UNIQUE (project_id, platform, runtime_version)
    );
    -- Same ADD-COLUMN-IF-NOT-EXISTS lesson as users.email_verified: this table already existed
    -- (empty — confirmed never written to before this) so CREATE TABLE IF NOT EXISTS alone won't
    -- add these on a deployment that already booted once with the old shape.
    ALTER TABLE app_configs ADD COLUMN IF NOT EXISTS package_name TEXT;
    ALTER TABLE app_configs ADD COLUMN IF NOT EXISTS bundle_identifier TEXT;
    ALTER TABLE app_configs ADD COLUMN IF NOT EXISTS min_supported_version TEXT;
    ALTER TABLE app_configs ADD COLUMN IF NOT EXISTS updated_at TEXT;
    -- Arbitrary JSON (stored as text, parsed by callers) an app can fetch at runtime independent
    -- of which OTA bundle is active — e.g. a UI variant flag, a feature toggle. Deliberately a
    -- single freeform blob rather than typed columns: this is meant for whatever a given app
    -- needs to read remotely without shipping a new OTA release, not a fixed schema OpenOTA
    -- itself understands or acts on.
    ALTER TABLE app_configs ADD COLUMN IF NOT EXISTS remote_config TEXT;
    -- One row per (project, platform) is the actual model now (runtime_version is just a field on
    -- it). No DB-level UNIQUE constraint for this — PGlite doesn't support ADD CONSTRAINT IF NOT
    -- EXISTS (Postgres 15+ only) and dropping/recreating the old three-column constraint needs
    -- its backend-generated name, which isn't worth the portability cost. appConfigsRepo.upsert()
    -- (find-by-project+platform, then insert-or-update) is what actually guarantees one row.

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

    -- Deployment history log for the dashboard's Environments/Release-history UI. The active-
    -- pointer file (see package/storage.service.ts) stays the actual source of truth for "what do
    -- devices get" — this table is a queryable log of the same events, written alongside it, never
    -- read by the check/download hot path. status: 'active' (currently pointed to) | 'inactive'
    -- (superseded by a later release) | 'rolled_back' (was active, a rollback moved past it).
    CREATE TABLE IF NOT EXISTS releases (
      id              TEXT PRIMARY KEY,
      project_id      TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      platform        TEXT NOT NULL,
      channel         TEXT NOT NULL DEFAULT 'production',
      version         TEXT NOT NULL,
      runtime_version TEXT NOT NULL,
      storage_key     TEXT NOT NULL,
      checksum        TEXT NOT NULL,
      size_bytes      BIGINT NOT NULL,
      status          TEXT NOT NULL DEFAULT 'active',
      created_at      TEXT NOT NULL,
      created_by      TEXT REFERENCES api_keys(id),
      UNIQUE (project_id, platform, channel, version)
    );
    CREATE INDEX IF NOT EXISTS idx_releases_lookup ON releases(project_id, platform, channel, runtime_version, status);
    ALTER TABLE releases ADD COLUMN IF NOT EXISTS release_notes TEXT;
    ALTER TABLE releases ADD COLUMN IF NOT EXISTS rollback_reason TEXT;
    -- Staged rollout: what fraction of devices on this (platform, channel) get the active release,
    -- gated by a deterministic hash of (deviceId, version) in checkForUpdate — see
    -- package/service.ts. Always 100 outside the dashboard-driven Cloud path (self-hosted has no
    -- releases-table writes at all, so it never reads anything but the default).
    ALTER TABLE releases ADD COLUMN IF NOT EXISTS rollout_percentage INTEGER NOT NULL DEFAULT 100;

    -- Purely presentational metadata on top of the existing channel mechanism (see
    -- package/storage.service.ts's per-(platform,channel) active-version pointer) — "Environment"
    -- in the dashboard IS a channel; this table only adds a color/description/display name so the
    -- UI has something nicer than a bare string. Never read by check/download/upload/rollback.
    CREATE TABLE IF NOT EXISTS environments (
      id          TEXT PRIMARY KEY,
      project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      channel     TEXT NOT NULL,
      name        TEXT NOT NULL,
      color       TEXT NOT NULL DEFAULT 'blue',
      description TEXT,
      created_at  TEXT NOT NULL,
      UNIQUE (project_id, channel)
    );
    CREATE INDEX IF NOT EXISTS idx_environments_project ON environments(project_id);

    -- One row per device per project: upserted on every check/download so this is a "last seen"
    -- registry (what the Devices dashboard page needs), not an unbounded event log. download_count
    -- is a running counter so Analytics can show a real number without a separate events table.
    CREATE TABLE IF NOT EXISTS device_checkins (
      id              TEXT PRIMARY KEY,
      project_id      TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      device_id       TEXT NOT NULL,
      platform        TEXT NOT NULL,
      app_version     TEXT NOT NULL,
      runtime_version TEXT NOT NULL,
      download_count  INTEGER NOT NULL DEFAULT 0,
      first_seen_at   TEXT NOT NULL,
      last_seen_at    TEXT NOT NULL,
      UNIQUE (project_id, device_id)
    );
    CREATE INDEX IF NOT EXISTS idx_device_checkins_project ON device_checkins(project_id, last_seen_at);

    -- Unlike device_checkins (a "last seen" registry), this IS an event log: every install
    -- attempt outcome is its own row, since Analytics needs counts over time, not just the latest
    -- status per device.
    CREATE TABLE IF NOT EXISTS install_results (
      id              TEXT PRIMARY KEY,
      project_id      TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      device_id       TEXT NOT NULL,
      platform        TEXT NOT NULL,
      version         TEXT NOT NULL,
      runtime_version TEXT NOT NULL,
      status          TEXT NOT NULL, -- "success" | "failure" | "rollback"
      created_at      TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_install_results_project ON install_results(project_id, status);

    -- Append-only deployment timeline: releases/rollbacks already leave a trace in the releases
    -- table (a row per version, status flipped in place), but that's current-state, not history —
    -- a rollback to an already-uploaded version updates that row's status without moving its
    -- created_at, so it can't be placed correctly on a timeline. Rollout-percentage changes leave
    -- no trace at all (setRolloutPercentage overwrites in place). This table exists so the
    -- dashboard's history view has one real, correctly-ordered timeline instead of inferring one
    -- from mutable current-state rows. Written from releasesRepo.recordActivation/setRolloutPercentage
    -- only — never read by check/download/upload/rollback.
    CREATE TABLE IF NOT EXISTS deployment_events (
      id                           TEXT PRIMARY KEY,
      project_id                   TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      platform                     TEXT NOT NULL,
      channel                      TEXT NOT NULL,
      event_type                   TEXT NOT NULL, -- "release" | "rollback" | "rollout_change"
      version                      TEXT NOT NULL,
      runtime_version              TEXT,
      rollout_percentage           INTEGER,
      previous_rollout_percentage  INTEGER,
      reason                       TEXT,
      actor_type                   TEXT NOT NULL, -- "api_key" | "user" | "system"
      actor_id                     TEXT,
      created_at                   TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_deployment_events_channel ON deployment_events(project_id, platform, channel, created_at DESC);

    -- Runtime-configurable global settings, editable by an admin from the dashboard without a
    -- redeploy — deliberately a plain key/value table (one row per setting) rather than a
    -- dedicated column per setting, since this is expected to grow ad hoc. First (and currently
    -- only) key: "email_test_mode" ('true' | 'false') — see auth/email.service.ts. Seeded to
    -- 'true' (test mode ON) so a fresh deployment never emails real users until an admin
    -- deliberately turns it off, matching the "testing stage" default this was added for.
    CREATE TABLE IF NOT EXISTS settings (
      key        TEXT PRIMARY KEY,
      value      TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    INSERT INTO settings (key, value, updated_at)
    VALUES ('email_test_mode', 'true', '1970-01-01T00:00:00.000Z')
    ON CONFLICT (key) DO NOTHING;
  `);
}

/** The single query entry point used by every repository. Throws if called before initDb(). */
export async function query<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> {
  if (!db) {
    throw new Error("Database not initialized — call initDb() at startup before handling requests.");
  }
  const result = await db.query<T>(text, params);
  return result.rows;
}
