# Epic 10 — Notificações por usuário (WhatsApp V1)

**Autor:** @architect (Aria) · **Data:** 2026-05-19 · **Status:** Design aprovado (Richard GO)
**Complexidade:** STANDARD · **Estimativa:** ~5-7d · **Tipo:** Backend + Schema + Frontend + Integração externa

## Contexto

Hoje os alertas de impressora são **globais**: `apps/api/src/notifier/alerts.ts`
detecta transições de estado (`processStateAlerts`, chamado em
`apps/api/src/ws/bridge-relay.ts:279`) e manda **tudo pra um único chat
Telegram** (`TELEGRAM_BOT_TOKEN`/`TELEGRAM_CHAT_ID`, env global). Não há
preferência por usuário, por impressora nem canal WhatsApp. Não existe
nenhuma tabela de notificação no schema (`packages/db/src/schema.ts`).

**Objetivo:** cada usuário cadastra/verifica um número WhatsApp e escolhe
**quais impressoras** e **quais eventos** quer receber.

## Decisões travadas (Richard, 2026-05-19 — não re-discutir)

| Tópico | Decisão |
|--------|---------|
| Canal V1 | Webhook **n8n criartificial** (mesmo da skill `wpp`) atrás de interface plugável. Trocar número/provider depois = trocar env/impl, sem migration |
| Eventos V1 | 4 essenciais: `print_finished`, `print_failed`, `hms_critical`, `printer_offline` |
| Verificação | Código opt-in, reusa padrão `send-code`/`verify-code` do Bambu, com rate-limit |
| Backward-compat | Telegram global **intocado** — WhatsApp por-usuário é **aditivo** |
| PII | Número de teste do Richard fora do git (env local gitignored) |

## Arquitetura

```
bridge-relay.ts → processStateAlerts(state, nameMap)   [detecção de transição: mantém]
        │
        ├─► [EXISTENTE] sendTelegramMessage(...)   ← INTOCADO (backward-compat)
        │
        └─► [NOVO] dispatchUserNotifications(printerId, eventType, payload)
               1. printer → org (printers.organizationId)
               2. org → organizationMembers → users
               3. users → notification_rules ativos que casam:
                    (printerId = este OR printerId IS NULL) AND eventType ∈ eventTypes
               4. rule → notification_channels (verified = true)
               5. NotificationChannel.send(destination, renderMessage(event))
                    └─ V1: WhatsAppN8nChannel → POST {to, text} no n8n
```

Disparo **assíncrono e não-bloqueante** (padrão já usado: `void ...`),
nunca derruba relay/broadcast. Reusa o `lastSnapshot` anti-spam do
`alerts.ts` (não re-dispara em estado estável).

### Componentes

- **`notifier/channels/types.ts`** — `interface NotificationChannel { send(destination: string, message: string): Promise<void> }`
- **`notifier/channels/whatsapp-n8n.ts`** — V1. `POST` no `N8N_WHATSAPP_WEBHOOK_URL` com `{ to: E.164, text }`. No-op silencioso se env ausente (igual `telegram.ts`).
- **`notifier/dispatch.ts`** — resolução de destinatários + render de mensagem por evento. Chamado pelo `alerts.ts` nas transições já detectadas.
- **`notifier/recipients.ts`** — query printer→org→members→rules→channels.

### Modelo de dados (shape — DDL detalhado é da Story 10.1 / @data-engineer)

`notification_channels`
- `id` uuid pk · `userId` fk users · `type` enum('whatsapp') (extensível)
- `destination` text (E.164, ex: `+5514…`) · `verified` bool default false
- `verifiedAt` timestamptz null · `codeHash` text null · `codeExpiresAt` timestamptz null
- `createdAt` · unique(`userId`,`type`,`destination`)

`notification_rules`
- `id` uuid pk · `userId` fk · `channelId` fk notification_channels
- `printerId` fk printers **NULL = todas as impressoras da org do user**
- `eventTypes` text[] (subset de `print_finished|print_failed|hms_critical|printer_offline`)
- `active` bool default true · `createdAt`/`updatedAt`
- index(`printerId`), index(`userId`)

> `printerId NULL` cobre o caso "adicionei impressora nova e não aparece":
> uma regra "todas" pega automaticamente impressoras futuras da org.

### API (apps/api Fastify)

- `GET  /api/notifications/channels` — canais do user (sem expor codeHash)
- `POST /api/notifications/channels` — cria canal whatsapp (unverified) `{ destination }`
- `POST /api/notifications/channels/:id/send-code` — gera código 6 díg, hash+expiry, envia via WhatsAppN8nChannel. **Rate-limit** (ex: 3/h por user+destino) — anti-spam de número de terceiro
- `POST /api/notifications/channels/:id/verify-code` — `{ code }` → marca verified
- `GET/PUT /api/notifications/rules` — CRUD das regras (impressora×eventos)

Autorização: user só cria regra pra impressora **da própria org**
(`organizationMembers`). Reusa o guard de sessão existente.

### Verificação (reuso do padrão Bambu)

`apps/api/src/routes` já tem `send-code`/`verify-code` pro Bambu —
mesmo shape: código numérico, hash em repouso, expiry curto (~10min),
rate-limit, tentativas limitadas. Canal `verified=false` **nunca** entra
na resolução de destinatários.

### Segurança / LGPD

- Opt-in verificado obrigatório (anti-abuso + consentimento explícito).
- Número nunca em log (mascarar `+55••••••1741`).
- Rate-limit no `send-code` (reuso do padrão de rate-limit do projeto).
- Texto de consentimento na UI: o que será enviado, como sair (desativar regra/remover canal).
- Encriptação do número em repouso: **considerar** (projeto já tem AES-256-GCM pra tokens Bambu). V1 pode guardar E.164 plain (é o próprio número do user, menor sensibilidade que token) — decidir na Story 10.1 com @data-engineer.

## Stories (cadeia SDC por story)

| # | Story | Dono primário | Depende de |
|---|-------|---------------|-----------|
| **10.1** | Schema `notification_channels` + `notification_rules` + migration | @data-engineer | — |
| **10.2** | Interface `NotificationChannel` + `WhatsAppN8nChannel` + env `N8N_WHATSAPP_WEBHOOK_URL` | @dev | — |
| **10.3** | Verificação número: rotas `send-code`/`verify-code` + rate-limit (reuso padrão Bambu) | @dev | 10.1, 10.2 |
| **10.4** | Refactor dispatch: `alerts.ts`→ resolve destinatários por user/printer (3 eventos já detectados) + Telegram global intocado | @dev | 10.1, 10.2 |
| **10.5** | Detecção `printer_offline` (watcher heartbeat/timeout no relay) + 4º evento | @dev | 10.4 |
| **10.6** | UI `/settings/notifications`: add/verifica número + matriz impressora×evento | @dev | 10.3, 10.4 |

Caminho crítico: `10.1 → 10.2 → (10.3 ∥ 10.4) → 10.5 → 10.6`.

### AC seeds (o @sm detalha no draft de cada story)

- **10.1**: 2 tabelas + migration aplicável; FK/índices; `printerId` nullable; `eventTypes` text[]; backward-compat (nenhuma tabela existente alterada destrutivamente).
- **10.2**: interface + impl n8n; env opcional (no-op sem env, igual telegram); teste de envio manual documentado (número do Richard, fora do git).
- **10.3**: send-code (rate-limited) + verify-code; código hasheado+expiry; canal vira verified; erros amigáveis; reuso explícito do padrão Bambu.
- **10.4**: `dispatchUserNotifications` resolve printer→org→members→rules→channels(verified); 3 eventos (`print_finished/failed`, `hms_critical`); Telegram global continua idêntico; anti-spam preservado; async não-bloqueante.
- **10.5**: watcher detecta ausência de estado > timeout (ou socket close) → `printer_offline`; recuperação (volta online) não spamma; integra no dispatch.
- **10.6**: página Settings; fluxo verificar número (enviar/confirmar código); matriz com "Todas as impressoras" + por impressora × 4 eventos; estado persistido em `notification_rules`; consentimento LGPD visível.

## Out of scope (V1.1+)

- Outros canais (email, push, Telegram por-usuário) — `type` enum já preparado.
- Quiet hours / agendamento / digest.
- Templates customizáveis pelo usuário.
- WhatsApp Cloud API oficial (migração de provider — interface já permite sem refactor).
- Per-org sharing de regras / regras a nível de org.

## Riscos

| Risco | Mitigação |
|-------|-----------|
| n8n/WhatsApp não-oficial (ban do número) | Interface plugável → migrar provider sem refactor; número dedicado depois |
| Spam de verificação em número de terceiro | Rate-limit no send-code + tentativas limitadas + expiry curto |
| Dispatch N+1 ou lento no relay | Resolução async, fora do hot-path; query indexada; cache de membros por org se necessário |
| Regressão no Telegram global | Caminho existente intocado; WhatsApp é aditivo; teste de não-regressão na 10.4 |
| Impressora nova não recebe (caso do Richard) | Regra com `printerId NULL` (= todas) resolve por design |

## Change Log

| Data | Agente | Mudança |
|------|--------|---------|
| 2026-05-19 | @architect (Aria) | Design do Epic 10 criado — decisões travadas com Richard, aterrado no notifier existente. GO pra @sm draftar 10.1. |
