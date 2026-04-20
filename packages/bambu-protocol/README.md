# @printstudio/bambu-protocol

TypeScript implementation of the Bambu Lab MQTT protocol used by PrintStudio.

**Source of truth:** [Doridian/OpenBambuAPI](https://github.com/Doridian/OpenBambuAPI) —
specifically [`mqtt.md`](https://github.com/Doridian/OpenBambuAPI/blob/main/mqtt.md).

## What this package provides

- `topics` — builders for MQTT topic strings (`device/{serial}/report`, `.../request`)
- `types` — Zod schemas for raw Bambu payloads
- `parsers` — convert Bambu payloads → PrintStudio domain types (`PrinterState`, `HmsError`, `AmsSlot`)
- `commands` — builders for command payloads (pause/resume/stop, pushall)

## What this package does NOT provide

- MQTT transport — use `mqtt.js` in the bridge app
- TLS certificate pinning — handled at transport layer
- FTP uploads — future v2, will be a separate package

## Connection notes (for the bridge app)

Bambu A1 in LAN mode:
- MQTT over TLS on port `8883`
- Username: `bblp`
- Password: the printer's `access_code` (8 digits from the panel)
- Insecure TLS (self-signed cert) — `rejectUnauthorized: false`

## Updating

When Bambu ships firmware that changes payload shapes:
1. Check OpenBambuAPI for updated docs
2. Update schemas in `types.ts` (keep `.passthrough()` — forward-compat)
3. Update parsers in `parsers.ts`
4. Bump minor version
