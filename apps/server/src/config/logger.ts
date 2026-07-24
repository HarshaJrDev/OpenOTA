import pino from "pino";

import { env } from "./env.js";

export const logger = pino({
  level: env.nodeEnv === "test" ? "silent" : "info",
  // pino-http's default request serializer logs req.headers verbatim — without this, every
  // upload/rollback/delete request's `Authorization: Bearer <OPENOTA_API_KEY>` header would be
  // written straight into the server's own logs. "censor" (not the header key itself) so it's
  // still visible *that* auth was attempted, just not the secret's value.
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "*.req.headers.authorization",
      "*.req.headers.cookie",
    ],
    censor: "[redacted]",
  },
  transport:
    env.nodeEnv === "production"
      ? undefined
      : {
          target: "pino-pretty",
          options: { colorize: true },
        },
});
