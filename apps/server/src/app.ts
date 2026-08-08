import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import compression from "compression";
import cors from "cors";
import express, { type Express } from "express";
import helmet from "helmet";
import pinoHttp from "pino-http";

import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { query } from "./db/client.js";
import { errorMiddleware } from "./middleware/error.middleware.js";
import { notFoundMiddleware } from "./middleware/notFound.middleware.js";
import { adminRouter } from "./modules/admin/routes.js";
import { authRouter } from "./modules/auth/routes.js";
import { apiKeyRouter } from "./modules/apikey/routes.js";
import { analyticsRouter } from "./modules/analytics/routes.js";
import { appsRouter } from "./modules/apps/routes.js";
import { devicesRouter } from "./modules/devices/routes.js";
import { environmentsRouter } from "./modules/environments/routes.js";
import { logsRouter } from "./modules/logs/routes.js";
import { createProjectPackageRouter } from "./modules/package/project-routes.js";
import { packageRouter } from "./modules/package/routes.js";
import { projectRouter } from "./modules/project/routes.js";
import { storageRouter } from "./modules/storage/routes.js";
import { createStorageProvider } from "./providers/storage/index.js";
import { sendSuccess } from "./shared/responses.js";

// The database is initialized by the entrypoint (server.ts) or test setup via initDb() before any
// request is served — it can't run here because app.ts is imported synchronously and the DB
// connect/bootstrap is async.
export const app: Express = express();

// Behind Render/most PaaS there is exactly one proxy hop in front of the app. Trusting it makes
// `req.ip` the real client address (from X-Forwarded-For) instead of the proxy's — required for
// the auth rate limiter to bucket per real client rather than lumping everyone together. `1`
// (not `true`) is deliberate: trusting *all* hops would let a client spoof its IP via a forged
// X-Forwarded-For header and evade the limiter.
app.set("trust proxy", 1);

app.use(pinoHttp.default({ logger }));

// Unset CORS_ALLOWED_ORIGINS reflects any origin for the CLI/device surface (see env.ts's comment
// on why that's acceptable there) — those routes are Bearer-token or unauthenticated, never
// cookie-based, so reflecting any origin carries no session with it.
//
// `credentials: true` is what makes the session cookie usable cross-origin at all, but it is only
// ever combined with reflect-any-origin (`origin: true`) OUTSIDE production. In production, with
// CORS_ALLOWED_ORIGINS unset, granting `credentials: true` to *any* reflected origin would let any
// attacker-controlled page make credentialed `fetch()` calls against every session-cookie route
// (admin, projects, api-keys, ...) and read/act on the response using a logged-in victim's
// session — the CORS origin check is the *only* thing standing between that and a real account
// takeover once SameSite=None is in play (see cookie.ts), so it must fail closed here, not open.
// Self-hosting without ever configuring the dashboard is unaffected: `credentials: false` still
// serves the open CLI/device surface exactly as before, it only stops a browser from attaching
// cookies cross-origin — same-origin dashboard deployments (or ones that DID set
// CORS_ALLOWED_ORIGINS) are unaffected either way.
const isProductionWithoutExplicitOrigins = env.nodeEnv === "production" && !env.corsAllowedOrigins;
app.use(
  cors(
    env.corsAllowedOrigins
      ? { origin: env.corsAllowedOrigins, credentials: true }
      : { origin: true, credentials: !isProductionWithoutExplicitOrigins },
  ),
);
app.use(helmet());
app.use(compression());

app.use(express.json());

// One instance shared by /health and the project package router below — cheap to construct, but
// no reason to make a fresh client (and, for Supabase, a fresh HTTP client) on every health check.
const storageProvider = createStorageProvider();

// Read once at startup, not per-request — the version never changes while the process is running.
const packageVersion: string = (() => {
  try {
    const packageJsonPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "package.json");
    return (JSON.parse(fs.readFileSync(packageJsonPath, "utf-8")) as { version: string }).version;
  } catch {
    return "unknown";
  }
})();

/**
 * Real connectivity checks, not just "the process is up" — a self-hosted deployment with a dead
 * DB connection or unreachable storage bucket still responds to plain HTTP, so a health check that
 * only confirms the process is running is close to useless for catching the failures that
 * actually matter. Both checks are cheap (a trivial query, a `list` on the storage root) and run
 * in parallel so one slow/hanging backend doesn't double the response time.
 */
app.get("/health", async (_req, res) => {
  const [database, storage] = await Promise.allSettled([query("SELECT 1"), storageProvider.list("")]);

  const databaseOk = database.status === "fulfilled";
  const storageOk = storage.status === "fulfilled";

  sendSuccess(res, {
    status: databaseOk && storageOk ? "ok" : "degraded",
    version: packageVersion,
    database: databaseOk ? "connected" : "unreachable",
    storage: storageOk ? "connected" : "unreachable",
    storageProvider: env.storageProvider,
  });
});

app.use("/api/packages", packageRouter);
app.use("/api/v1/packages", packageRouter);
app.use("/packages", packageRouter);

// OpenOTA Cloud / multi-tenant surface — additive, does not change the flat routes above (see
// apiKey.middleware.ts's doc comment for how self-hosted-simple mode and project-scoped mode
// coexist under one `requireApiKey`).
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/admin", adminRouter);
app.use("/api/v1/projects", projectRouter);
app.use("/api/v1/projects/:projectId/api-keys", apiKeyRouter);
app.use("/api/v1/projects/:projectId/packages", createProjectPackageRouter(storageProvider));
app.use("/api/v1/projects/:projectId/devices", devicesRouter);
app.use("/api/v1/projects/:projectId/apps", appsRouter);
app.use("/api/v1/projects/:projectId/environments", environmentsRouter);
app.use("/api/v1/projects/:projectId/logs", logsRouter);
app.use("/api/v1/projects/:projectId/analytics", analyticsRouter);
app.use("/api/v1/projects/:projectId/storage", storageRouter);

app.use(notFoundMiddleware);
app.use(errorMiddleware);
