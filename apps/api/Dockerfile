# syntax=docker/dockerfile:1.7
# Multi-stage build for @printstudio/api. Optimized for EasyPanel deploy.

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
COPY apps/api/package.json ./apps/api/

RUN pnpm install --frozen-lockfile --prod=false

# -----------------------------------------------------------------------------
# Stage 2: build — compile api + its workspace deps
# -----------------------------------------------------------------------------
FROM node:20-alpine AS build
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /repo

COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps /repo/packages/db/node_modules ./packages/db/node_modules
COPY --from=deps /repo/apps/api/node_modules ./apps/api/node_modules

COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY packages/db ./packages/db
COPY apps/api ./apps/api

RUN pnpm --filter @printstudio/api build

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
COPY apps/api/package.json ./apps/api/

RUN pnpm install --frozen-lockfile --prod

# O bundle do esbuild (apps/api/build.mjs) inclui workspace deps
# inline (@printstudio/db, @printstudio/shared). Só precisamos do
# bundle final + node_modules das deps externas (fastify, drizzle,
# argon2, etc — instaladas pelo `pnpm install --prod` acima).
COPY --from=build /repo/apps/api/dist ./apps/api/dist

WORKDIR /repo/apps/api
EXPOSE 4000
CMD ["node", "dist/index.js"]
