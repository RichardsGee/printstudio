# syntax=docker/dockerfile:1.7
# Multi-stage build for @printstudio/worker. Optimized for EasyPanel deploy.

# -----------------------------------------------------------------------------
# Stage 1: deps — install the whole workspace (needed for workspace: protocols)
# -----------------------------------------------------------------------------
FROM node:20-alpine AS deps
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /repo

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/db/package.json ./packages/db/
COPY packages/bambu-protocol/package.json ./packages/bambu-protocol/
COPY apps/worker/package.json ./apps/worker/

RUN pnpm install --frozen-lockfile --prod=false

# -----------------------------------------------------------------------------
# Stage 2: build — bundle worker + workspace deps inline (esbuild)
# -----------------------------------------------------------------------------
FROM node:20-alpine AS build
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /repo

COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps /repo/packages/db/node_modules ./packages/db/node_modules
COPY --from=deps /repo/packages/bambu-protocol/node_modules ./packages/bambu-protocol/node_modules
COPY --from=deps /repo/apps/worker/node_modules ./apps/worker/node_modules

COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY packages/db ./packages/db
COPY packages/bambu-protocol ./packages/bambu-protocol
COPY apps/worker ./apps/worker

ARG GIT_SHA
RUN echo "Building worker ${GIT_SHA:-unknown}" \
 && pnpm --filter @printstudio/worker build

# -----------------------------------------------------------------------------
# Stage 3: runtime — minimal image with prod deps only
# -----------------------------------------------------------------------------
FROM node:20-alpine AS runtime
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /repo

ENV NODE_ENV=production

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/db/package.json ./packages/db/
COPY packages/bambu-protocol/package.json ./packages/bambu-protocol/
COPY apps/worker/package.json ./apps/worker/

RUN pnpm install --frozen-lockfile --prod

COPY --from=build /repo/apps/worker/dist ./apps/worker/dist

WORKDIR /repo/apps/worker
CMD ["node", "dist/index.js"]
