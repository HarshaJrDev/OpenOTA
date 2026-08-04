# Backups, restore, and migration

Two things need backing up for a self-hosted OpenOTA server, and they're independent of each
other:

```
Database (Cloud-mode metadata)     Storage (release bundles)
  users, projects, API keys,         the actual .zip bundles,
  releases, environments, ...        manifests, active pointers
        |                                    |
        v                                    v
  DATABASE_URL unset: PGlite         STORAGE_PROVIDER=local: disk
  DATABASE_URL set: real Postgres    STORAGE_PROVIDER=supabase: bucket
```

Which backup method applies depends entirely on which mode each is running in — check your
`.env` (or `docker-compose.yml`'s defaults) before following a section below.

## Database

### PGlite (default — `DATABASE_URL` unset)

The embedded database lives on disk at `apps/server/data/pgdata` (relative to wherever the
server process runs from — see `db/client.ts`). It's a real Postgres data directory, just not a
separately-running server.

**Docker (`docker compose`):** this directory is the named volume `openota_pgdata`
(`docker-compose.yml`) — back it up like any Docker volume:
```sh
docker run --rm \
  -v openota_pgdata:/data -v "$(pwd)":/backup \
  alpine tar czf /backup/openota-pgdata-backup.tar.gz -C /data .
```

**Bare metal / no Docker:** stop the server, then archive the directory directly:
```sh
tar czf openota-pgdata-backup.tar.gz -C apps/server/data pgdata
```
Stopping the server first avoids backing up mid-write state — PGlite has no separate "hot backup"
tool the way a real Postgres server does.

### Real Postgres / Supabase (`DATABASE_URL` set)

This is a standard Postgres database — use standard Postgres tooling:
```sh
pg_dump "$DATABASE_URL" -Fc -f openota-db-backup.dump
```
If `DATABASE_URL` points at a Supabase project, Supabase also takes its own automatic backups
(frequency depends on your plan) — check Project Settings → Database → Backups in the Supabase
dashboard. `pg_dump` is still worth doing yourself for an off-platform copy.

## Storage (release bundles)

### Local disk (`STORAGE_PROVIDER=local`)

**Docker:** the named volume `openota_storage`:
```sh
docker run --rm \
  -v openota_storage:/data -v "$(pwd)":/backup \
  alpine tar czf /backup/openota-storage-backup.tar.gz -C /data .
```

**Bare metal:** archive `STORAGE_ROOT` directly (default `./storage`):
```sh
tar czf openota-storage-backup.tar.gz -C . storage
```

### Supabase Storage (`STORAGE_PROVIDER=supabase`)

Bundles live in your own Supabase Storage bucket — back it up the same way you'd back up any
Supabase Storage bucket (Supabase doesn't currently offer one-click bucket export; scripting
downloads via the Storage API against every key under `projects/` is the practical option if you
want an off-platform copy). Before relying on the bucket at all, confirm it's actually reachable
and writable:
```sh
npx openota storage validate --provider supabase \
  --supabase-url https://<ref>.supabase.co \
  --supabase-key <service role key> \
  --supabase-bucket openota-releases
```

## Restore

1. Stop the server.
2. **Database:** either restore the PGlite directory (`docker run --rm -v openota_pgdata:/data -v "$(pwd)":/backup alpine tar xzf /backup/openota-pgdata-backup.tar.gz -C /data`, or the bare-metal equivalent extracting into `apps/server/data/pgdata`), or `pg_restore -d "$DATABASE_URL" --clean openota-db-backup.dump` for real Postgres.
3. **Storage:** restore the same way, into the `openota_storage` volume or `STORAGE_ROOT` directory. Supabase-hosted storage has nothing to "restore" locally — you're restoring whatever you scripted a copy of, back into the bucket.
4. Start the server, then confirm both came back clean:
   ```sh
   curl http://localhost:3900/health
   # database and storage should both read "connected"
   ```

## Migration (switching storage providers)

Moving from local disk to Supabase (or back) is a **credentials + config change, not a data
migration** — `STORAGE_PROVIDER` picks one backend or the other, and existing bundles under the
old provider are not copied automatically. `npx openota storage setup` (see
[SELF_HOSTING.md](./SELF_HOSTING.md)) validates the new provider and writes `.env` for you, but if
you need existing releases to keep working under the new provider, copy the actual bundle files
across yourself first (same shape either way: `projects/{projectId}/{platform}/{version}/...`) —
this project doesn't currently ship an automated storage migration tool.
