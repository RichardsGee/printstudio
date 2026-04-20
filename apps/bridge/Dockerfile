FROM node:20-alpine AS base
RUN apk add --no-cache python3 make g++ sqlite
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

WORKDIR /app

FROM base AS build
COPY pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages ./packages
COPY apps/bridge ./apps/bridge
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @printstudio/bridge build

FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages ./packages
COPY --from=build /app/apps/bridge/dist ./apps/bridge/dist
COPY --from=build /app/apps/bridge/package.json ./apps/bridge/package.json

WORKDIR /app/apps/bridge
EXPOSE 8080
CMD ["node", "dist/index.js"]
