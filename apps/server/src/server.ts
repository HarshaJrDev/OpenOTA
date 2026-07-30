import { app } from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { initDb } from "./db/client.js";

// Bootstrap the database (connect + create tables) before accepting any request.
initDb()
  .then(() => {
    app.listen(env.port, () => {
      logger.info(`🚀 OpenOTA running on http://localhost:${env.port}`);
    });
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
