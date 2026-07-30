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
      size_bytes      BIGINT NOT NULL,
      status          TEXT NOT NULL DEFAULT 'active',
      created_at      TEXT NOT NULL,
      created_by      TEXT REFERENCES api_keys(id),
      UNIQUE (project_id, platform, channel, version)
    );
    CREATE INDEX IF NOT EXISTS idx_releases_lookup ON releases(project_id, platform, channel, runtime_version, status);
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
