# OpenOTA command & API reference

Full walkthrough: [GETTING_STARTED.md](./GETTING_STARTED.md). This page is the flat reference.

## Deployments

| | URL |
|---|---|
| Production backend | `https://openota.onrender.com` |
| Production API base | `https://openota.onrender.com/api/v1` |
| Health check | `https://openota.onrender.com/health` |
| Self-hosted default | `http://localhost:3001/api/v1` |

## CLI (`npx openota <command>`)

| Command | Purpose |
|---|---|
| `openota init --server-url <url> [--runtime-version <x.y.z>]` | Scaffold `openota.config.json` in a React Native project |
| `openota doctor` | Check Node/RN/Android/iOS/Metro/config/server reachability |
| `openota build --version <x.y.z> [--platform android\|ios] [--dev]` | Bundle + hash + zip, no upload |
| `openota upload --zip <path> --platform <p> --version <v>` | Upload an already-built zip |
| `openota release --version <x.y.z> [--platform <p>] [--dev]` | `build` + `upload` in one step |
| `openota rollback --platform <p> --version <x.y.z>` | Move the server's active-version pointer back to an already-uploaded version |
| `openota login --api-key <key>` | Store an API key for authenticated requests |
| `openota logout` | Remove the stored API key |

**Environment override** (any command): `OPENOTA_SERVER_URL=<url>` overrides `serverUrl` from
`openota.config.json` without editing the file — useful for CI or pointing at a different
deployment temporarily.

### Examples

```sh
# First-time setup in a React Native project
npx openota init --server-url https://openota.onrender.com/api/v1 --runtime-version 1.0.0

# Ship a release
npx openota release --version 1.0.4 --platform android

# Ship to a different server without touching openota.config.json
OPENOTA_SERVER_URL=https://staging.example.com/api/v1 npx openota release --version 1.0.4-rc1 --platform android

# Stop a bad release from reaching new devices
npx openota rollback --platform android --version 1.0.3

# Build only (e.g. to inspect the zip before uploading)
npx openota build --version 1.0.4 --platform android
```

## REST API

Base path: `/api/v1/packages` (also mounted at `/api/packages` and `/packages` for compatibility).

| Method | Path | Body / Query | Purpose |
|---|---|---|---|
| `GET` | `/health` (repo root, not under `/packages`) | — | Liveness check |
| `POST` | `/` | multipart: `file`, `platform`, `version`, `runtimeVersion`, `bundleName`, `sha256`, `size`, `assets[]?` | Upload a package |
| `GET` | `/` | — | List every uploaded package |
| `GET` | `/check` | `?platform=android&currentVersion=1.0.0` | Check for an update; returns manifest + fresh signed download URL if available |
| `GET` | `/:platform/:version` | — | Get one package's metadata |
| `GET` | `/:platform/:version/download` | — | Stream the zip directly (works in both local and Supabase modes) |
| `POST` | `/rollback` | `{ "platform": "android", "version": "1.0.3" }` | Move the active-version pointer |
| `DELETE` | `/:platform/:version` | — | Delete a package (all its files, in either storage backend) |

### Example requests

```sh
# Health
curl https://openota.onrender.com/health

# Check for an update
curl "https://openota.onrender.com/api/v1/packages/check?platform=android&currentVersion=1.0.0"

# List all packages
curl https://openota.onrender.com/api/v1/packages/

# Roll back
curl -X POST https://openota.onrender.com/api/v1/packages/rollback \
  -H "Content-Type: application/json" \
  -d '{"platform":"android","version":"1.0.3"}'

# Delete a package
curl -X DELETE https://openota.onrender.com/api/v1/packages/android/1.0.4
```

### Error codes

| Code | HTTP status | Meaning |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Malformed request (bad version format, missing field) |
| `PACKAGE_NOT_FOUND` | 404 | No package for that platform+version |
| `PACKAGE_ALREADY_EXISTS` | 409 | That platform+version was already uploaded |
| `PACKAGE_TOO_LARGE` | 413 | Upload exceeds `OPENOTA_MAX_PACKAGE_SIZE_MB` (deployment config, not a protocol limit) |
| `UPLOAD_FAILED` | 400 | Unsupported file type or similar upload-time failure |
| `STORAGE_ERROR` | 500 | Underlying storage provider (local disk or Supabase) failed |
| `NOT_FOUND` | 404 | Unknown route |

## Server environment variables (`apps/server/.env`)

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3001` | HTTP port (Render/hosts usually inject this) |
| `NODE_ENV` | `development` | `test` disables dotenv loading entirely — see `apps/server/README.md` |
| `STORAGE_PROVIDER` | `local` | `local` or `supabase` |
| `STORAGE_ROOT` | `./storage` | Disk path, only used when `STORAGE_PROVIDER=local` |
| `SUPABASE_URL` | — | Required when `STORAGE_PROVIDER=supabase` |
| `SUPABASE_SERVICE_ROLE_KEY` | — | Required when `STORAGE_PROVIDER=supabase` — **server-only secret, never exposed to clients** |
| `SUPABASE_STORAGE_BUCKET` | `openota-releases` | Must be a **private** bucket |
| `OPENOTA_MAX_PACKAGE_SIZE_MB` | `200` | Deployment-configured upload limit (hosted backend uses `50`, matching Supabase's Free plan) |
| `OPENOTA_API_KEY` | unset (open) | Optional shared secret gating `upload`/`rollback`/`delete` — see `docs/SELF_HOSTING.md` "Authentication" |

Startup fails immediately with a clear error if `STORAGE_PROVIDER=supabase` is set without the
required Supabase variables — it will never silently fall back to local storage.

## Docker self-hosting

```sh
cp .env.example .env
docker compose up -d
curl http://localhost:3900/health
```

See `docs/SELF_HOSTING.md` for storage persistence, the Supabase variant, and deploying without
Docker.

## SDK (`@openota/sdk`, on-device)

```ts
import { OTA } from "@openota/sdk";

OTA.configure({ serverUrl, channel, autoRestart, requestTimeout });

await OTA.check();                 // is there an update?
await OTA.download(manifest, onProgress); // download + extract + verify
await OTA.install(extracted);      // stage as active
await OTA.sync(onEvent);           // check → download → verify → install, one call
await OTA.restart();               // reload JS bundle now
await OTA.rollback();              // revert to the previously-installed bundle
await OTA.getRuntimeInfo();        // current state machine + bundle info
await OTA.getCurrentVersion();     // currently active version
await OTA.clearCache();            // wipe downloads/cache dirs
await OTA.resetRuntime();          // wipe everything, back to the embedded bundle
```

## Native runtime states (`packages/native-android`)

```
EMBEDDED → DOWNLOADED → VERIFIED → EXTRACTED → INSTALLED → ACTIVATED
                                                                 ↓
                                                             ROLLBACK
FAILED — reachable from any non-terminal state
```
