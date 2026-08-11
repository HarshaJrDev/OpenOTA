// PM2 process definitions for all three OpenOTA apps, pointed at the `current` symlink that
// deploy.sh atomically swaps to the newest release. Install once:
//   pm2 start ecosystem.config.js
// Every later deploy reloads the dashboard/docs apps via `pm2 reload`/`startOrReload` (see
// deploy.sh) — this file itself rarely changes.
//
// Ports are internal-only (127.0.0.1) — nginx is what's actually exposed on 80/443.
//
// exec_mode: openota-server runs "fork" (1 instance), NOT "cluster" — deliberately. If
// DATABASE_URL is unset, apps/server falls back to an embedded PGlite database (a real Postgres
// engine running in-process, persisted to a local directory). Running more than one instance
// against the SAME PGlite data directory would mean multiple processes independently reading/
// writing the same on-disk database with no cross-process coordination — silent corruption risk.
// Once you point DATABASE_URL at a real external Postgres (recommended for production — see
// deploy/rsync-vps/README.md), it becomes safe to raise `instances` and switch to "cluster" here.
//
// IMPORTANT — do NOT deploy openota-server with `pm2 reload`/`startOrReload`, only `pm2 restart`.
// This was originally documented as safe on the theory that fork-mode + 1 instance avoids the
// old+new-concurrently overlap that makes cluster-mode reload zero-downtime — that theory was
// wrong. `pm2 reload` still briefly starts the new process before the old one has fully exited
// even in fork mode, and that overlap corrupted this exact on-disk PGlite database in a real
// production incident. deploy.sh/rollback.sh now use `pm2 restart` for openota-server
// specifically; if you ever reload it by hand, use `restart`, not `reload`/`startOrReload`.
// The dashboard and docs apps have no such constraint (stateless Next.js SSR) and correctly keep
// using cluster-mode zero-downtime reloads.
module.exports = {
  apps: [
    {
      name: "openota-server",
      cwd: "/var/www/openota/current/apps/server",
      script: "dist/server.js",
      interpreter: "node",
      exec_mode: "fork",
      instances: 1,
      env: {
        NODE_ENV: "production",
        PORT: 3001,
      },
      max_memory_restart: "512M",
      autorestart: true,
      exp_backoff_restart_delay: 100,
      max_restarts: 10,
      // apps/server already handles both SIGTERM and SIGINT for graceful shutdown (drains
      // in-flight requests, closes the WebSocket server, then exits) — PM2's default stop signal
      // (SIGINT) is handled correctly with no extra config needed.
      kill_timeout: 10000,
      out_file: "/var/www/openota/shared/logs/server-out.log",
      error_file: "/var/www/openota/shared/logs/server-error.log",
      time: true,
    },
    {
      name: "openota-dashboard",
      cwd: "/var/www/openota/current/apps/dashboard",
      // Not node_modules/.bin/next — under pnpm that's a #!/bin/sh wrapper script, not JS, and PM2
      // executes the `script` path directly through `interpreter` (node) rather than honoring its
      // shebang, which fails with a syntax error trying to parse shell as JS. Next's actual bin
      // entrypoint (what that wrapper ultimately execs) is real JS and works correctly.
      script: "node_modules/next/dist/bin/next",
      interpreter: "node",
      args: "start -p 3002",
      exec_mode: "cluster",
      instances: 2,
      env: {
        NODE_ENV: "production",
        PORT: 3002,
      },
      max_memory_restart: "512M",
      autorestart: true,
      exp_backoff_restart_delay: 100,
      max_restarts: 10,
      kill_timeout: 10000,
      out_file: "/var/www/openota/shared/logs/dashboard-out.log",
      error_file: "/var/www/openota/shared/logs/dashboard-error.log",
      time: true,
    },
    {
      name: "openota-docs",
      cwd: "/var/www/openota/current/apps/docs",
      script: "node_modules/next/dist/bin/next",
      interpreter: "node",
      args: "start -p 3003",
      exec_mode: "cluster",
      instances: 2,
      env: {
        NODE_ENV: "production",
        PORT: 3003,
      },
      max_memory_restart: "512M",
      autorestart: true,
      exp_backoff_restart_delay: 100,
      max_restarts: 10,
      kill_timeout: 10000,
      out_file: "/var/www/openota/shared/logs/docs-out.log",
      error_file: "/var/www/openota/shared/logs/docs-error.log",
      time: true,
    },
  ],
};
