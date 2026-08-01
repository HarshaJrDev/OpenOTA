import compression from "compression";
import cors from "cors";
import express, { type Express } from "express";
import helmet from "helmet";
import pinoHttp from "pino-http";

import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { errorMiddleware } from "./middleware/error.middleware.js";
import { notFoundMiddleware } from "./middleware/notFound.middleware.js";
import { authRouter } from "./modules/auth/routes.js";
import { apiKeyRouter } from "./modules/apikey/routes.js";
import { analyticsRouter } from "./modules/analytics/routes.js";
import { appsRouter } from "./modules/apps/routes.js";
import { devicesRouter } from "./modules/devices/routes.js";
import { environmentsRouter } from "./modules/environments/routes.js";
import { createProjectPackageRouter } from "./modules/package/project-routes.js";
import { packageRouter } from "./modules/package/routes.js";
import { projectRouter } from "./modules/project/routes.js";
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
// on why that's acceptable there). The dashboard's session cookie needs `credentials: true` PLUS
// an explicit origin allowlist to work cross-origin at all (browsers refuse `Access-Control-
// Allow-Origin: *` together with credentialed requests) — set CORS_ALLOWED_ORIGINS to the
// dashboard's origin(s) in any deployment that uses the cookie-authenticated dashboard endpoints.
// `origin: true` (not the `cors` default of `*`) reflects the request's own Origin header — `*`
// is rejected by browsers on credentialed requests, so this is required for the cookie to work at
// all when no explicit allowlist is configured.
app.use(
  cors(
    env.corsAllowedOrigins
      ? { origin: env.corsAllowedOrigins, credentials: true }
      : { origin: true, credentials: true },
  ),
);
app.use(helmet());
app.use(compression());

app.use(express.json());

app.get("/health", (_req, res) => {
  sendSuccess(res, { status: "ok" });
});

app.use("/api/packages", packageRouter);
app.use("/api/v1/packages", packageRouter);
app.use("/packages", packageRouter);

// OpenOTA Cloud / multi-tenant surface — additive, does not change the flat routes above (see
// apiKey.middleware.ts's doc comment for how self-hosted-simple mode and project-scoped mode
// coexist under one `requireApiKey`).
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/projects", projectRouter);
app.use("/api/v1/projects/:projectId/api-keys", apiKeyRouter);
app.use("/api/v1/projects/:projectId/packages", createProjectPackageRouter(createStorageProvider()));
app.use("/api/v1/projects/:projectId/devices", devicesRouter);
app.use("/api/v1/projects/:projectId/apps", appsRouter);
app.use("/api/v1/projects/:projectId/environments", environmentsRouter);
app.use("/api/v1/projects/:projectId/analytics", analyticsRouter);

app.use(notFoundMiddleware);
app.use(errorMiddleware);
