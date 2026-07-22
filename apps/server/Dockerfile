# Build context must be the monorepo root (not apps/server) — this is a pnpm workspace, and
# @openota/server imports @openota/shared's *compiled* dist output, not its source, so both need
# to be present for `pnpm install` (which resolves the whole workspace graph) and for the build.
#
#   docker build -f apps/server/Dockerfile -t openota-server .
#
# (docker-compose.yml at the repo root already sets this up correctly — just `docker compose up`.)

FROM node:20-alpine AS build
WORKDIR /repo
RUN corepack enable

# Full monorepo source is copied (see .dockerignore for what's excluded) rather than
# cherry-picking package.json files — pnpm's lockfile describes every workspace member, and a
# partial copy makes `pnpm install --frozen-lockfile` fail looking for missing workspace projects.
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @openota/shared build && pnpm --filter @openota/server build

# --- runtime stage: only what's needed to run the already-built server ------
FROM node:20-alpine AS runtime
WORKDIR /repo
ENV NODE_ENV=production
RUN corepack enable

COPY --from=build /repo/node_modules node_modules
COPY --from=build /repo/package.json /repo/pnpm-workspace.yaml ./
COPY --from=build /repo/packages/shared/package.json packages/shared/package.json
COPY --from=build /repo/packages/shared/dist packages/shared/dist
COPY --from=build /repo/apps/server/package.json apps/server/package.json
COPY --from=build /repo/apps/server/dist apps/server/dist

WORKDIR /repo/apps/server
EXPOSE 3900

CMD ["node", "dist/server.js"]
