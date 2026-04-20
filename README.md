# PrintStudio

Plataforma de gestão para 3x impressoras **Bambu Lab A1**.

- 📡 **Dual-mode**: LAN direto (baixa latência) + Cloud fallback (remoto)
- 🖥️ **Web-first** (PWA), mobile depois
- 🏠 **Self-hosted** no EasyPanel, bridge local no PC

## Status

🚧 **Em arquitetura** — docs em `docs/architecture/fullstack-architecture.md`.

## Quickstart (futuro)

1. Copie `.env.example` → `.env` e preencha
2. Veja `docs/guides/easypanel-setup.md` pra deploy da cloud
3. No PC local (bridge): `cd apps/bridge && npm install && npm run dev`

## Documentação

- [Arquitetura Fullstack](./docs/architecture/fullstack-architecture.md)
- [Setup EasyPanel](./docs/guides/easypanel-setup.md)
- Stories: `docs/stories/` (geradas pelo @sm)

## Stack

Node.js 20 · Fastify · Next.js 15 · PostgreSQL 16 · Auth.js · go2rtc · MQTT (bambu-node)
