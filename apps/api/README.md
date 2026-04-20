# @printstudio/api

Cloud service for PrintStudio. Relays WebSocket traffic between `apps/bridge` (user's PC) and `apps/web` (PWA), persists state/events to Postgres, and serves REST endpoints.

## Scripts

```bash
pnpm dev         # tsx watch
pnpm build       # tsc -> dist/
pnpm start       # node dist/index.js
pnpm typecheck
```

## Environment

Copy `.env.example` to `.env` and fill in:

- `DATABASE_URL` — Postgres connection
- `AUTH_SECRET` — session signing secret
- `CLOUD_API_TOKEN` — shared token for the bridge to authenticate
- `API_PORT` — default 4000
- `API_CORS_ORIGIN` — PWA origin (single origin MVP)

## Endpoints

### WebSocket
- `/ws/bridge` — bridge agent connection (token-auth via `bridge.hello`)
- `/ws/client` — PWA client connection (session-auth via cookie)

### REST
- `GET /api/health` — liveness + DB check
- `GET/POST /api/printers` and `/api/printers/:id` — printer CRUD
- `GET /api/jobs` — job history (filterable)
- `GET /api/events` — event log (filterable)
- `POST /api/auth/login` — email+password -> session cookie
- `POST /api/auth/logout`
- `GET /api/auth/me`

## Deploy to EasyPanel

1. Point EasyPanel at this repo and select `apps/api/Dockerfile`.
2. Set the required env vars in the service's Environment tab.
3. Expose port `API_PORT` (default 4000).
4. Ensure the Postgres service is reachable via the internal network (`DATABASE_URL`).
5. Point `apps/bridge` `CLOUD_WS_URL` at the public WS URL (e.g. `wss://api.printstudio.example.com/ws/bridge`).
6. Point `apps/web` `NEXT_PUBLIC_API_URL` / `NEXT_PUBLIC_WS_URL` at the same host.

## Architecture

One active bridge per deployment (MVP). The in-memory hub (`src/ws/hub.ts`) fans out bridge messages to client subscribers filtered by printer ID and forwards client commands to the bridge.
