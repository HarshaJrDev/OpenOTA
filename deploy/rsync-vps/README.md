# Deploying OpenOTA — Mac → VPS via rsync, no Git on the server

Real, ready-to-use deployment for `openota.xyz` on your Contabo Ubuntu 24.04 VPS. No GitHub
Actions, no Git repository on the server — you push code straight from your Mac with `rsync`, and
the VPS only ever contains built releases.

**Nothing here has been run against your actual VPS** — I don't have SSH access to it. Every
script passed `bash -n` syntax checking and the PM2 config passed `node -c`, but the real
verification is you running it. Read this whole document once before your first deploy.

---

## 1. Architecture

```
Your Mac                                    VPS (Contabo, openota.xyz)
─────────                                    ──────────────────────────
git repo (OpenOTA/)                          nginx (80/443, SSL already installed)
  │                                             │
  │ rsync (source only,                         ├─ openota.xyz, docs.openota.xyz  ──┐
  │  no node_modules/.next/dist)                ├─ dashboard.openota.xyz            │
  ▼                                             └─ api.openota.xyz                  │
deploy.sh ───────────────────────────────►                                          │
                                              /var/www/openota/                     │
                                                releases/                           │
                                                  20260807-041530/  (old)           │
                                                  20260807-050112/  (new) ◄─────────┘
                                                current -> releases/20260807-050112/  (symlink)
                                                shared/
                                                  env/{server,dashboard,docs}.env
                                                  logs/
                                                  ecosystem.config.js
                                                                │
                                                                ▼
                                              PM2: openota-server (127.0.0.1:3001, fork)
                                                   openota-dashboard (127.0.0.1:3002, cluster x2)
                                                   openota-docs (127.0.0.1:3003, cluster x2)
```

**Why the `releases/<timestamp>/` + `current` symlink pattern** (not one mutable directory):
this one mechanism gives you three of your requirements at once —
- **Automatic backup before deployment**: the previous release is never touched or deleted until
  the new one passes its health check. It IS the backup.
- **Rollback strategy**: rolling back is re-pointing one symlink + `pm2 reload`. No file copying,
  no "restore from backup" step that can itself fail.
- **Near-zero-downtime**: the new release is fully built and ready *before* traffic ever touches
  it. PM2 only reloads once the code is already in place.

This is the same pattern Capistrano/Deployer popularized — it's boring, well-understood, and hard
to get wrong.

---

## 2. Folder structure on the VPS

```
/var/www/openota/
├── releases/
│   ├── 20260807-041530/        # a full deploy: apps/, packages/, node_modules/, built output
│   └── 20260807-050112/
├── current -> releases/20260807-050112/    # symlink deploy.sh atomically swaps
└── shared/
    ├── env/
    │   ├── server.env           # real secrets — chmod 600, never in git, never rsynced
    │   ├── dashboard.env
    │   └── docs.env
    ├── logs/                    # PM2 out/error logs (see ecosystem.config.js)
    └── ecosystem.config.js      # copied here once, not per-release
```

Nothing under `releases/` is ever edited in place — every deploy is a fresh directory. Nothing
under `shared/` is ever touched by a deploy except via the symlinks `deploy.sh` creates.

---

## 3. One-time setup (do this once, before your first deploy)

```sh
# On the VPS
scp -r deploy/rsync-vps/scripts your-user@your-vps:/tmp/openota-setup   # or just paste the script
ssh your-user@your-vps
bash /tmp/openota-setup/setup-vps.sh
```

This creates the directory layout above, installs `pm2-logrotate`, and prints the `pm2 startup`
command you need to run once (can't be scripted — it depends on your OS/init system).

Then:
1. **Fill in the three env files** on the VPS (`/var/www/openota/shared/env/*.env`) — see §4.
2. **Copy the PM2 config**: `cp deploy/rsync-vps/pm2/ecosystem.config.js /var/www/openota/shared/ecosystem.config.js` (from your Mac via `scp`, or paste it directly).
3. **Install the nginx configs** — see §5.
4. **Edit `deploy.sh` and `rollback.sh`** — set `VPS_HOST` and `VPS_USER` at the top of each to your real values.
5. From your Mac: `./deploy/rsync-vps/scripts/deploy.sh` — your first real deploy.

### Use a non-root deploy user

Don't deploy as `root`. Create a dedicated user with `sudo` only where it's actually needed
(reloading nginx), and use that for `VPS_USER`:

```sh
# On the VPS, as root, once:
adduser deploy
usermod -aG sudo deploy                      # only if you want it to manage nginx reloads itself
mkdir -p /var/www/openota
chown -R deploy:deploy /var/www/openota
# Copy your Mac's SSH public key into /home/deploy/.ssh/authorized_keys, same as any other user.
```

---

## 4. Environment variable handling

Each app's env file lives once, outside every release, and gets symlinked into the fresh release
on every deploy (`deploy.sh` Step 4). You edit them directly on the VPS — they never touch your
Mac, never touch rsync, never touch git.

### `shared/env/server.env` → symlinked to `apps/server/.env`

```sh
PORT=3001
NODE_ENV=production
CORS_ALLOWED_ORIGINS=https://dashboard.openota.xyz
DASHBOARD_URL=https://dashboard.openota.xyz

# Storage — local disk is fine for a single-VPS deployment. See docs/STORAGE.md for Supabase.
STORAGE_PROVIDER=local
STORAGE_ROOT=/var/www/openota/shared/storage

# Real Postgres strongly recommended for production (see ecosystem.config.js's comment on why
# the embedded PGlite fallback can't run more than one instance safely). Leave unset only if
# you're intentionally staying single-instance.
# DATABASE_URL=postgresql://user:pass@host:5432/openota

SESSION_SECRET=<generate: openssl rand -hex 32>
# dashboard.openota.xyz and api.openota.xyz are both subdomains of openota.xyz — that's same-site
# for cookie purposes, so Lax works and is the safer default (see cookie.ts's own doc comment for
# why this differs from a split-domain Cloud deployment).
SESSION_COOKIE_CROSS_SITE=false

OPENOTA_MAX_PACKAGE_SIZE_MB=200

# Optional single-shared-secret gate for self-hosted upload/rollback (leave unset to run open —
# fine if this VPS is otherwise not publicly writable, e.g. behind your own network controls).
# OPENOTA_API_KEY=<generate a real secret if you want this>
```

### `shared/env/dashboard.env` → symlinked to `apps/dashboard/.env.local`

```sh
NEXT_PUBLIC_OPENOTA_SERVER_URL=https://api.openota.xyz/api/v1
```

(This is a `NEXT_PUBLIC_*` var — it gets baked into the client bundle at **build time**, which is
exactly why `deploy.sh` links env files in *before* running the build, not after.)

### `shared/env/docs.env` → symlinked to `apps/docs/.env.local`

Only needed if apps/docs reads any env vars itself (check `apps/docs/.env.local` locally for what
you're currently using) — an empty file is fine otherwise.

---

## 5. Nginx

Three config files in `deploy/rsync-vps/nginx/`:

| File | Hostnames | Upstream |
|---|---|---|
| `openota-website.conf` | `openota.xyz`, `docs.openota.xyz` | `127.0.0.1:3003` (apps/docs — one app serves both the marketing site and the docs) |
| `openota-dashboard.conf` | `dashboard.openota.xyz` | `127.0.0.1:3002` |
| `openota-api.conf` | `api.openota.xyz` | `127.0.0.1:3001` (+ WebSocket support, 220MB upload limit) |

```sh
# On the VPS
sudo cp deploy/rsync-vps/nginx/*.conf /etc/nginx/sites-available/
sudo ln -s /etc/nginx/sites-available/openota-website.conf /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/openota-dashboard.conf /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/openota-api.conf /etc/nginx/sites-enabled/
sudo nginx -t          # validates syntax before touching the live config
sudo systemctl reload nginx
```

Each config's `ssl_certificate` path assumes Let's Encrypt's default layout
(`/etc/letsencrypt/live/<domain>/`). Since you said SSL is already installed, just confirm the
paths match what you actually have (`sudo certbot certificates` lists them) — edit the three
`.conf` files if your cert is organized differently (e.g. one cert covering all four hostnames vs.
three separate certs).

---

## 6. Monorepo build strategy

`turbo.json`'s `build` task already declares `"dependsOn": ["^build"]` — meaning "build every
workspace dependency first." So a single command:

```sh
pnpm turbo run build --filter=@openota/server --filter=@openota/dashboard --filter=docs
```

automatically builds `@openota/shared` (which both `server` and `dashboard` depend on) before
building those three — you never need to manually sequence package builds yourself. `deploy.sh`
uses exactly this command, scoped down further with `--filter` when you deploy a single app
(`./deploy.sh server`).

What each app's `build` actually does:
- `@openota/server`: `tsc` → `dist/server.js` (run via `node dist/server.js` in production, not `tsx`)
- `@openota/dashboard`: `next build` → `.next/`
- `docs`: `next build` → `.next/`

---

## 7. Zero-downtime deployment — what's really zero, and what isn't

- **Dashboard and docs** run PM2 `cluster` mode with 2 instances each. `pm2 reload` restarts
  instances one at a time, only routing traffic to the new instance once it's confirmed up — genuinely
  zero dropped connections.
- **The API server** runs `fork` mode, 1 instance, **on purpose** — see `ecosystem.config.js`'s
  comment. If `DATABASE_URL` is unset, the server falls back to an embedded PGlite database (a
  real Postgres engine running in-process); running more than one instance against the same
  on-disk PGlite data directory risks corruption, since there's no cross-process coordination.
  `pm2 reload` on a single fork-mode instance still gets a graceful handoff (the app already
  handles `SIGTERM`/`SIGINT` to drain in-flight requests before exiting — see `server.ts`), so
  it's close to zero-downtime, just not the same hard guarantee cluster mode gives you.
  **If you want the API in cluster mode too**: point `DATABASE_URL` at a real Postgres (a small
  managed instance, or Postgres installed alongside on this same VPS), then change
  `ecosystem.config.js`'s `openota-server` block to `exec_mode: "cluster"` and raise `instances`.

---

## 8. Deployment checklist

**Before your first deploy:**
- [ ] `setup-vps.sh` run on the VPS
- [ ] All three `shared/env/*.env` files filled in with real values
- [ ] `ecosystem.config.js` copied to `shared/ecosystem.config.js`
- [ ] Nginx configs installed, `nginx -t` passes, reloaded
- [ ] DNS for `openota.xyz`, `docs.openota.xyz`, `dashboard.openota.xyz`, `api.openota.xyz` all point at the VPS
- [ ] `VPS_HOST`/`VPS_USER` edited at the top of `deploy.sh` and `rollback.sh`
- [ ] SSH key-based login works: `ssh your-user@your-vps` with no password prompt
- [ ] `pm2 startup` has been run once on the VPS

**Every deploy:**
- [ ] `git status` clean on your Mac (know exactly what you're shipping)
- [ ] `./deploy.sh` (or `./deploy.sh server` / `dashboard` / `docs` for a single app)
- [ ] Watch the health-check step — a failure auto-rolls-back, but confirm the log says so
- [ ] Spot-check the actual site in a browser after

**If something's wrong after a deploy that passed health checks:**
- [ ] `./rollback.sh --list` to see available releases
- [ ] `./rollback.sh` (defaults to the release immediately before current) or `./rollback.sh <release-id>`

---

## 9. Production security recommendations

- **Never deploy as root** — see §3's non-root user setup.
- **SSH**: key-based auth only. On the VPS: `sudo sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config && sudo systemctl reload sshd` — only after you've confirmed key-based login works from a **fresh terminal**, not the one you're already authenticated in.
- **Firewall**: `ufw allow OpenSSH && ufw allow 80/tcp && ufw allow 443/tcp && ufw default deny incoming && ufw enable`. Do **not** open 3001/3002/3003 — those are only ever reached via nginx on `127.0.0.1`, and opening them publicly would let anyone bypass nginx's rate limiting and TLS entirely.
- **fail2ban** for SSH brute-force protection: `apt install fail2ban`, the default `sshd` jail is enough on top of key-only auth.
- **`shared/env/*.env` permissions**: `chmod 600` (done by `setup-vps.sh`) — readable only by the deploy user.
- **Don't `--delete` into `shared/`**: `deploy.sh`'s rsync only ever targets `releases/<timestamp>/`, never `shared/` — this is deliberate, so a bad rsync invocation can never wipe your env files or logs.

---

## 10. SSL renewal

You said Let's Encrypt is already installed. Confirm auto-renewal is actually active (Certbot's
own package installs a systemd timer that handles this — nothing extra to build):

```sh
sudo systemctl status certbot.timer   # should show "active (waiting)"
sudo certbot renew --dry-run          # confirms renewal would succeed, without actually renewing
```

If `certbot.timer` isn't enabled: `sudo systemctl enable --now certbot.timer`.

---

## 11. Log management

- **PM2 logs**: `shared/logs/{server,dashboard,docs}-{out,error}.log`. `setup-vps.sh` installs
  `pm2-logrotate` (20MB per file, 14 rotations, compressed) so these never grow unbounded.
- **Live tail**: `pm2 logs openota-server` (or `dashboard`/`docs`) on the VPS.
- **Nginx logs**: standard `/var/log/nginx/access.log` / `error.log` — not touched by anything
  here; use your distro's default `logrotate` config for those (Ubuntu ships one already).

---

## 12. PM2 startup on reboot

`setup-vps.sh` prints the exact command (`pm2 startup`) — it must be run interactively once
because it needs to detect your init system and generate a systemd unit file scoped to your exact
user. After that:

```sh
pm2 save   # snapshots the current process list — this is what gets restored on boot
```

Run `pm2 save` again any time the *set* of running apps changes (not needed for ordinary
deploys/reloads, only if you add/remove an app from `ecosystem.config.js`).

---

## 13. Health check endpoint

`apps/server` already has a real `/health` endpoint that checks actual database and storage
connectivity (not just "the process is up") — `openota-api.conf` proxies it at
`https://api.openota.xyz/health`, and `deploy.sh`/`rollback.sh` both hit it directly on
`127.0.0.1:3001` as part of every deploy. The dashboard and docs apps don't have a dedicated
health route — `deploy.sh` just checks that `/` returns `200`, which is enough to catch "the
Next.js server didn't start" without needing a purpose-built endpoint for two static-ish sites.
