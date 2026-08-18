import { app } from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { captureException, initSentry } from "./config/sentry.js";
import { initDb } from "./db/client.js";
import { seedDemoAccountIfEnabled, seedTestUsersIfEnabled } from "./db/seed.js";
import { attachLiveWebSocketServer } from "./modules/live/server.js";

// No-op unless SENTRY_DSN is set — see config/sentry.ts.
initSentry();

// Nothing here blocks boot — these are advisories about configurations that work perfectly on a
// single instance (today's reality — see ttlCache.ts's doc comment) but silently break if this
// ever runs as more than one dyno/replica, so they're worth surfacing before that bites someone.
function warnAboutScalingRisks(): void {
  if (env.nodeEnv !== "production") {
    return;
  }

  if (env.storageProvider === "local") {
    logger.warn(
      "STORAGE_PROVIDER=local in production: package bytes live on this instance's local disk. " +
        "Fine for exactly one instance with a persistent disk; running more than one instance (or " +
        "an instance with no persistent disk) will silently serve inconsistent/missing packages. " +
        "Use STORAGE_PROVIDER=supabase to scale beyond one instance.",
    );
  }

  if (!env.databaseUrl) {
    logger.warn(
      "DATABASE_URL unset in production: falling back to embedded PGlite on local disk. Fine for " +
        "exactly one instance; user/project/API-key/release metadata will not be shared or survive " +
        "if this instance is replaced. Set DATABASE_URL to a managed Postgres (e.g. Supabase) for " +
        "anything beyond a single throwaway instance.",
    );
  }

  if (!env.corsAllowedOrigins) {
    logger.warn(
      "CORS_ALLOWED_ORIGINS unset in production: the session cookie will not be sent on cross-origin " +
        "requests (see app.ts), so the dashboard won't stay logged in unless it's served from the same " +
        "origin as this API. The CLI/device surface (Bearer-token or unauthenticated) is unaffected. Set " +
        "CORS_ALLOWED_ORIGINS to your dashboard's exact origin if you're using the cookie-authenticated " +
        "dashboard cross-origin.",
    );
  }

  // CORS_ALLOWED_ORIGINS being set is the best available signal that this is a real multi-tenant
  // Cloud-style deployment (a solo self-hosted operator has no reason to configure it — see its
  // schema comment). OPENOTA_API_KEY unlocks the *legacy flat* /api/packages surface (routes.ts),
  // whose list/getOne/download endpoints have zero auth and zero project scoping by design, for a
  // single-operator deployment that predates the multi-tenant project model entirely. The two
  // together mean that surface is live, unauthenticated, and globally-scoped on what looks like a
  // Cloud deployment — see the Phase 2 security audit's F-3 finding. Not a hard failure (it may be
  // a deliberate, understood choice), but worth a loud warning since it's easy to end up here by
  // accident (e.g. OPENOTA_API_KEY left over from an earlier single-tenant setup).
  if (env.apiKey && env.corsAllowedOrigins) {
    logger.warn(
      "Both OPENOTA_API_KEY and CORS_ALLOWED_ORIGINS are set: this looks like a multi-tenant Cloud " +
        "deployment (CORS_ALLOWED_ORIGINS) that also has the legacy single-tenant flat package surface " +
        "unlocked (OPENOTA_API_KEY). /api/packages, /api/v1/packages, and /packages have unauthenticated, " +
        "unscoped list/read/download endpoints by design for that legacy surface — if anything is ever " +
        "uploaded through it here, it becomes globally public with no project isolation. If this is " +
        "intentional, ignore this warning; if OPENOTA_API_KEY is a leftover from before this deployment " +
        "adopted multi-tenant projects, unset it.",
    );
  }
}

warnAboutScalingRisks();

// Without these, a crash on Render is whatever landed in stdout/stderr at the moment — Node's
// default uncaughtException handler prints and exits, but not through pino, so it's easy to miss
// in a log stream mixed with normal request logs. Logging first (structured, same as every other
// error) then exiting preserves Node's actual safety behavior (the process state is untrusted
// after an uncaught exception — it still must exit) while making sure the reason is visible.
process.on("uncaughtException", (error) => {
  logger.fatal({ err: error }, "uncaught exception — exiting");
  captureException(error);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  logger.fatal({ err: reason }, "unhandled promise rejection — exiting");
  captureException(reason);
  process.exit(1);
});

// Bootstrap the database (connect + create tables) before accepting any request.
initDb()
  .then(async () => {
    await seedDemoAccountIfEnabled();
    await seedTestUsersIfEnabled();

    const server = app.listen(env.port, () => {
      logger.info(`🚀 OpenOTA running on http://localhost:${env.port}`);
    });

    const live = attachLiveWebSocketServer(server);

    // Render (and most PaaS) send SIGTERM before killing a dyno on redeploy/scale-down. Without
    // this, in-flight requests get dropped mid-response instead of finishing — closing the server
    // stops accepting new connections but lets active ones complete first.
    function shutdown(signal: string) {
      logger.info({ signal }, "shutting down");
      live.close();
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
