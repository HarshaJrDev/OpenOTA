import compression from "compression";
import cors from "cors";
import express, { type Express } from "express";
import helmet from "helmet";
import pinoHttp from "pino-http";

import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { errorMiddleware } from "./middleware/error.middleware.js";
import { notFoundMiddleware } from "./middleware/notFound.middleware.js";
import { packageRouter } from "./modules/package/routes.js";
import { sendSuccess } from "./shared/responses.js";

export const app: Express = express();

app.use(pinoHttp.default({ logger }));

// Unset CORS_ALLOWED_ORIGINS reflects any origin (see env.ts's comment on why this is an
// acceptable default here); set it to restrict to specific origins in a stricter deployment.
app.use(cors(env.corsAllowedOrigins ? { origin: env.corsAllowedOrigins } : undefined));
app.use(helmet());
app.use(compression());

app.use(express.json());

app.get("/health", (_req, res) => {
  sendSuccess(res, { status: "ok" });
});

app.use("/api/packages", packageRouter);
app.use("/api/v1/packages", packageRouter);
app.use("/packages", packageRouter);

app.use(notFoundMiddleware);
app.use(errorMiddleware);
