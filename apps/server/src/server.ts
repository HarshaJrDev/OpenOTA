import { app } from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { initDb } from "./db/client.js";

// Without these, a crash on Render is whatever landed in stdout/stderr at the moment — Node's
// default uncaughtException handler prints and exits, but not through pino, so it's easy to miss
// in a log stream mixed with normal request logs. Logging first (structured, same as every other
// error) then exiting preserves Node's actual safety behavior (the process state is untrusted
// after an uncaught exception — it still must exit) while making sure the reason is visible.
process.on("uncaughtException", (error) => {
  logger.fatal({ err: error }, "uncaught exception — exiting");
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  logger.fatal({ err: reason }, "unhandled promise rejection — exiting");
  process.exit(1);
});

// Bootstrap the database (connect + create tables) before accepting any request.
initDb()
  .then(() => {
    const server = app.listen(env.port, () => {
      logger.info(`🚀 OpenOTA running on http://localhost:${env.port}`);
    });

    // Render (and most PaaS) send SIGTERM before killing a dyno on redeploy/scale-down. Without
    // this, in-flight requests get dropped mid-response instead of finishing — closing the server
    // stops accepting new connections but lets active ones complete first.
    function shutdown(signal: string) {
      logger.info({ signal }, "shutting down");
      server.close(() => process.exit(0));
      // Belt-and-suspenders: if something (a stuck connection) prevents close() from ever firing
      // its callback, don't hang forever and get force-killed without a clean exit code.
      setTimeout(() => process.exit(1), 10_000).unref();
    }

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
  })
  .catch((error) => {
    logger.error({ err: error }, "Failed to initialize the database — shutting down");

    // ENETUNREACH to a bracketed IPv6-looking address on the Postgres port is almost always
    // Supabase's *direct* connection hostname (db.<ref>.supabase.co), which is IPv6-only — most
    // hosts (Render, Railway, Fly, ...) have no IPv6 egress. The fix is switching DATABASE_URL to
    // Supabase's connection pooler (Project Settings -> Database -> Connection string -> "Session
    // pooler" for a persistent server like this one), which is IPv4. This hint turns a cryptic
    // socket error into an actionable one without needing to re-read this incident's chat history.
    const message = error instanceof Error ? error.message : String(error);
    if (error && typeof error === "object" && "code" in error && error.code === "ENETUNREACH" && message.includes(":")) {
      logger.error(
        "Hint: this looks like Supabase's IPv6-only 'Direct connection' host. Use the 'Session pooler' " +
          "connection string instead (Supabase dashboard -> Project Settings -> Database -> Connection " +
          "string), which is IPv4-compatible.",
      );
    }

    process.exit(1);
  });
