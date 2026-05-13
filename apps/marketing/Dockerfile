# Multi-stage Dockerfile pro apps/marketing (story 7.1).
# Build: pnpm + Next.js static export → out/
# Runtime: nginx:alpine serve static + security headers.

FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

FROM base AS deps
WORKDIR /repo
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY apps/marketing ./apps/marketing
RUN pnpm install --frozen-lockfile || pnpm install

FROM base AS builder
WORKDIR /repo
COPY --from=deps /repo .
RUN pnpm --filter @printstudio/marketing build

FROM nginx:alpine AS runner
COPY --from=builder /repo/apps/marketing/out /usr/share/nginx/html
COPY apps/marketing/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
