# @printstudio/bridge

PrintStudio local bridge agent. Runs on a PC on the same LAN as the Bambu Lab A1 printers.

## Responsibilities

- Connect via MQTT (TLS, port 8883) to each printer in LAN mode
- Maintain in-memory `PrinterState` for each printer, merged from `device/{serial}/report` payloads
- Expose local HTTP + WebSocket API on `BRIDGE_PORT` (default 8080) for the PWA on LAN
- Open outbound WebSocket to the cloud API (`CLOUD_WS_URL`) and relay state/events
- Forward commands from either direction (cloud or LAN) back to the printers via MQTT
- Advertise `printstudio.local` via mDNS for dual-mode (LAN/cloud) detection by the PWA
- Persist print job history locally in SQLite (`data/bridge.db`)

## Quickstart

```bash
# from repo root
pnpm install
cp apps/bridge/.env.example apps/bridge/.env
# edit apps/bridge/.env with your printer serials / access codes
pnpm dev:bridge
```

## Endpoints (LAN)

| Method | Path                         | Description                    |
| ------ | ---------------------------- | ------------------------------ |
| GET    | `/api/health`                | Health + mode=bridge           |
| GET    | `/api/printers`              | List of all printer states     |
| GET    | `/api/printers/:id`          | Single printer state           |
| POST   | `/api/printers/:id/command`  | Body: `{ action }`             |
| WS     | `/ws`                        | Real-time BridgeMessage stream |

## Camera streams

Camera streaming is NOT handled inside Node. Install [go2rtc](https://github.com/AlexxIT/go2rtc) separately and use `go2rtc.yaml.example` as a starting point.

## Build

```bash
pnpm --filter @printstudio/bridge build
pnpm --filter @printstudio/bridge start
```
