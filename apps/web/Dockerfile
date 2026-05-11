FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat python3 make g++
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

FROM base AS deps
WORKDIR /repo
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY packages/db ./packages/db
COPY apps/web ./apps/web
RUN pnpm install --frozen-lockfile || pnpm install

FROM base AS builder
WORKDIR /repo
COPY --from=deps /repo ./
ENV NEXT_TELEMETRY_DISABLED=1

# Build args precisam ser declarados como ARG aqui pra Docker passar
# os --build-arg do EasyPanel. Depois converte em ENV pro Next.js
# embedar nos chunks JS no build estático.
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_WS_URL
ARG NEXT_PUBLIC_LAN_DISCOVERY_HOST
ARG NEXT_PUBLIC_LAN_DISCOVERY_PORT
ARG NEXT_PUBLIC_APP_NAME
ARG GIT_SHA
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL
ENV NEXT_PUBLIC_LAN_DISCOVERY_HOST=$NEXT_PUBLIC_LAN_DISCOVERY_HOST
ENV NEXT_PUBLIC_LAN_DISCOVERY_PORT=$NEXT_PUBLIC_LAN_DISCOVERY_PORT
ENV NEXT_PUBLIC_APP_NAME=$NEXT_PUBLIC_APP_NAME

# Invalida o cache da camada de build a cada novo commit, garantindo
# que mudanças nas envs públicas sempre re-executem o `next build`.
RUN echo "Building ${GIT_SHA:-unknown}" \
 && pnpm --filter @printstudio/web build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

COPY --from=builder /repo/apps/web/public ./apps/web/public
COPY --from=builder --chown=nextjs:nodejs /repo/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /repo/apps/web/.next/static ./apps/web/.next/static

USER nextjs
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
