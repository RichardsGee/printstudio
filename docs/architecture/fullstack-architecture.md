# PrintStudio — Fullstack Architecture

**Versão:** 1.0 (MVP v1)
**Autor:** Aria (Architect)
**Data:** 2026-04-19
**Status:** Draft para validação

---

## 1. Visão Geral

Plataforma de gestão para 3x impressoras **Bambu Lab A1** com acesso **dual-mode nativo** (LAN direto quando em casa, cloud quando fora), frontend **Web-first** (PWA) e preparada para evolução mobile.

**Uso:** interno (família/time pequeno), sem multi-tenant complexo no MVP.

### 1.1 Princípios de design

| Princípio | Aplicação |
|-----------|-----------|
| **Local-first** | LAN usa MQTT direto (< 100ms de latência) sem depender da cloud |
| **Cloud como fallback** | Acesso remoto via cloud sem perder features críticas |
| **Stateless frontend** | Mesma PWA detecta rede e escolhe o endpoint |
| **Single source of truth** | Estado mestre fica no agente local; cloud é replica |
| **Evoluível** | MVP simples, mas com espaço pra multi-user e mobile |

---

## 2. Arquitetura Dual-Mode (Opção C)

```
                          ┌──────────────────────────────────┐
                          │      EasyPanel (VPS Docker)      │
                          │  ┌─────────────┐  ┌───────────┐  │
                          │  │ Backend API │  │ PWA Web   │  │
                          │  │ Fastify+WS  │  │ Next.js   │  │
                          │  └──────┬──────┘  └───────────┘  │
                          │         │                        │
                          │  ┌──────▼──────┐  ┌───────────┐  │
                          │  │ PostgreSQL  │  │ n8n       │  │
                          │  │ (EasyPanel) │  │ (notif)   │  │
                          │  └─────────────┘  └───────────┘  │
                          └──────────────▲───────────────────┘
                                         │ WebSocket
                                         │ (outbound)
                                         │
  ┌─────────────────── CASA (LAN) ───────┼────────────────────┐
  │                                      │                    │
  │  ┌──────────────────┐    ┌───────────▼─────────────┐      │
  │  │  PC Local        │    │   Bridge Agent (Node)   │      │
  │  │  (seu computer)  │───▶│  ┌───────────────────┐  │      │
  │  │                  │       │  │ MQTT Client       │  │    │
  │  └──────────────────┘       │  │ (bambu-node)      │  │    │
  │                             │  └───────────────────┘  │    │
  │                             │  ┌───────────────────┐  │    │
  │                             │  │ Fastify API + WS  │  │    │
  │                             │  │ (:8080)           │  │    │
  │                             │  └───────────────────┘  │    │
  │                             │  ┌───────────────────┐  │    │
  │                             │  │ go2rtc            │  │    │
  │                             │  │ (RTSP → WebRTC)   │  │    │
  │                             │  └───────────────────┘  │    │
  │                             │  ┌───────────────────┐  │    │
  │                             │  │ SQLite local      │  │    │
  │                             │  │ (cache + histórico)│ │    │
  │                             │  └───────────────────┘  │    │
  │                             └─────────────────────────┘    │
  │                                         ▲                  │
  │                                         │ MQTT (LAN)       │
  │       ┌─────────┐  ┌─────────┐  ┌──────┴──┐                │
  │       │ A1 #1   │  │ A1 #2   │  │ A1 #3   │                │
  │       └─────────┘  └─────────┘  └─────────┘                │
  │                                                            │
  └────────────────────────────────────────────────────────────┘

                           ┌──────────────┐
                           │ PWA Client   │
                           │ (Next.js)    │
                           │              │
                           │ 1) Tenta LAN │
                           │ 2) Fallback  │
                           │    cloud     │
                           └──────────────┘
```

### 2.1 Como o dual-mode funciona (na prática)

1. **PWA carrega** → busca `/api/health` em:
   - `http://printstudio.local:8080` (mDNS) ou IP fixo da LAN
   - Se responder em < 800ms → **modo LAN** (latência mínima, tudo direto)
   - Se falhar → **modo CLOUD** (`https://api.printstudio.app`)
2. **Estado de conexão** exibido no header: 🟢 LAN / ☁️ Cloud
3. **Bridge local** mantém WebSocket persistente com a cloud (outbound, fura NAT sem port-forward) → cloud sempre tem telemetria atualizada

### 2.2 Source of Truth

| Dado | Mestre | Réplica |
|------|--------|---------|
| Telemetria real-time | Bridge local (memória) | Cloud (últimos 5 min) |
| Histórico de prints | SQLite local | Supabase (sync periódico) |
| Configurações | Supabase | Bridge pula pra local no boot |
| Comandos (pause/cancel) | Enviados via qualquer endpoint → bridge executa | — |

---

## 3. Stack Técnica

### 3.1 Bridge Agent (local)

| Componente | Tech | Justificativa |
|-----------|------|---------------|
| Runtime | **Node.js 20 LTS** | Stack unificada TS em tudo |
| MQTT transport | **`mqtt.js`** | Lib MQTT universal, madura, TLS suportado |
| Bambu protocol | **`@printstudio/bambu-protocol`** (interno) | Implementação TS do spec OpenBambuAPI (topics, parsers, types) |
| API | **Fastify 4** | Mais rápido que Express, schema-first |
| WebSocket | **`@fastify/websocket`** | Integrado, zero boilerplate |
| Storage local | **SQLite** (better-sqlite3) | Zero-config, perfeito pra cache |
| Câmera | **go2rtc** (Go binary) | RTSP → WebRTC com baixa latência |
| FTP (v2) | **`basic-ftp`** | Upload `.3mf` via FTP (doc: OpenBambuAPI) |
| Process mgr | **PM2** ou systemd | Auto-restart |

### 3.2 Backend Cloud

| Componente | Tech | Justificativa |
|-----------|------|---------------|
| Runtime | **Node.js 20 LTS** (mesmo bridge) | Reuso de código |
| API | **Fastify 4** | Consistência |
| DB | **PostgreSQL 16** (EasyPanel service) | Self-hosted, sem vendor lock-in, backups do EasyPanel |
| Auth | **Auth.js (NextAuth v5)** | 1-2 users internos; email+senha simples |
| Realtime relay | **WebSocket** | Bridge → Cloud → PWA remoto |
| Notificações | **n8n webhook** (EasyPanel) | Você já usa; mesma VPS |
| File storage | **MinIO** (EasyPanel) ou filesystem | Pra `.3mf` no v2 |

### 3.3 Frontend (Web PWA)

| Componente | Tech | Justificativa |
|-----------|------|---------------|
| Framework | **Next.js 15** (App Router) | SSR, RSC, PWA support |
| UI | **Tailwind + shadcn/ui** | Rápido, bonito, customizável |
| Estado | **Zustand** + **TanStack Query** | Real-time + cache |
| WebSocket | **socket.io-client** ou nativo | Telemetria live |
| PWA | **next-pwa** | Offline + instalável |
| Câmera | **`<video>` + WebRTC** | Nativo do browser |
| Charts | **Recharts** | Temps, progresso histórico |

### 3.4 Deploy

| Onde | O que | Observação |
|------|-------|------------|
| **Casa** | PC local do Richard rodando o bridge | Zero hardware extra por enquanto |
| **VPS (EasyPanel)** | API + PWA + Postgres + n8n | Você já tem o EasyPanel rodando |
| **Domínio** | — | Adiamos. Acesso por IP:porta no MVP |

**Custo adicional: R$0** (reusa infra existente).

### 3.4.1 Services no EasyPanel (MVP)

```
EasyPanel project: printstudio
├── postgres         → PostgreSQL 16 (service)
├── api              → Node.js (build from git)
├── web              → Next.js (build from git)
└── n8n              → (já existe? ou subir novo)
```

---

## 4. Data Model (MVP v1)

```sql
-- Impressoras cadastradas
CREATE TABLE printers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,              -- "A1 Sala", "A1 Ateliê"
  serial TEXT NOT NULL UNIQUE,     -- Serial da Bambu
  access_code TEXT NOT NULL,       -- LAN access code
  ip_address INET,                 -- IP local
  model TEXT DEFAULT 'A1',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Snapshot de estado (última telemetria conhecida)
CREATE TABLE printer_state (
  printer_id UUID PRIMARY KEY REFERENCES printers(id) ON DELETE CASCADE,
  status TEXT,                     -- IDLE|PRINTING|PAUSED|ERROR|OFFLINE
  progress_pct NUMERIC(5,2),
  current_layer INT,
  total_layers INT,
  nozzle_temp NUMERIC(5,1),
  bed_temp NUMERIC(5,1),
  chamber_temp NUMERIC(5,1),
  remaining_sec INT,
  current_file TEXT,
  hms_errors JSONB,                -- Array de códigos HMS ativos
  ams_state JSONB,                 -- Filamentos, cores, humidade
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Histórico de prints
CREATE TABLE print_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  printer_id UUID REFERENCES printers(id),
  file_name TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  finished_at TIMESTAMPTZ,
  status TEXT,                     -- SUCCESS|FAILED|CANCELLED
  duration_sec INT,
  filament_used_g NUMERIC(7,2),
  layers_total INT,
  thumbnail_url TEXT,
  error_summary TEXT
);

-- Log de eventos/alertas
CREATE TABLE events (
  id BIGSERIAL PRIMARY KEY,
  printer_id UUID REFERENCES printers(id),
  type TEXT,                       -- PRINT_START|PRINT_DONE|ERROR|FILAMENT_RUNOUT
  severity TEXT,                   -- INFO|WARN|ERROR
  message TEXT,
  payload JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Usuários (simples pro MVP — 1-2 pessoas, Auth.js gerencia)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,     -- bcrypt via Auth.js credentials provider
  role TEXT DEFAULT 'admin',
  notification_channels JSONB,     -- { telegram_chat_id, email }
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabelas de sessão do Auth.js (gera automaticamente via adapter)
-- accounts, sessions, verification_tokens
```

---

## 5. API Principal

### 5.1 REST Endpoints

```
GET    /api/printers                 # Lista as 3 impressoras
GET    /api/printers/:id             # Estado atual (snapshot)
GET    /api/printers/:id/jobs        # Histórico de prints
POST   /api/printers/:id/pause       # Comando
POST   /api/printers/:id/resume
POST   /api/printers/:id/cancel
GET    /api/printers/:id/camera      # URL do stream WebRTC
GET    /api/events?printer_id=&type= # Log de eventos
GET    /api/health                   # Health check (usado pelo dual-mode detector)
```

### 5.2 WebSocket (real-time)

```
ws://printstudio.local:8080/ws   (LAN)
wss://api.printstudio.app/ws     (Cloud)

Eventos inbound (server → client):
  printer.state      { printer_id, status, progress, temps, ... }
  printer.event      { printer_id, type, severity, message }
  printer.camera     { printer_id, webrtc_offer }

Eventos outbound (client → server):
  subscribe          { printer_ids: [...] }
  command            { printer_id, action: 'pause'|'resume'|'cancel' }
```

---

## 6. MVP v1 — Features Detalhadas

### 6.1 Dashboard principal
- 3 cards lado a lado, 1 por impressora
- Por card: nome, status badge, % progresso, tempo restante, temps (bico/mesa), preview do arquivo
- Indicador dual-mode no header (🟢 LAN / ☁️ Cloud)

### 6.2 Detalhe da impressora
- Stream de câmera ao vivo (WebRTC)
- Gráfico de temperatura em tempo real (últimos 10 min)
- Estado do AMS (4 slots, cores, %)
- Botões: pause / resume / cancel
- Log de eventos recentes

### 6.3 Histórico
- Lista dos últimos 50 prints (todos os printers)
- Filtros: impressora, status, período
- Detalhe: duração, filamento usado, thumbnail

### 6.4 Notificações
- Canal único pro MVP: **Telegram** (via n8n webhook)
- Eventos notificados:
  - Print finalizado ✅
  - Erro HMS detectado ❌
  - Filamento acabou / AMS precisa atenção ⚠️
- Configuração: 1 chat_id por usuário

### 6.5 Auth
- Supabase Auth (email + senha)
- 1-2 usuários cadastrados manualmente no MVP

---

## 7. Roadmap de Implementação (por epics/stories)

### Epic 1: Foundation
- Story 1.1: Setup monorepo (pnpm workspaces): `/bridge`, `/api`, `/web`, `/shared`
- Story 1.2: Schema Supabase + migrations
- Story 1.3: CI/CD (GitHub Actions → Railway + Vercel)

### Epic 2: Bambu Protocol Package
- Story 2.1: Topics builder (device/{serial}/{report,request}) + types base
- Story 2.2: Parsers de payload (PrintStatus, GcodeState, HMS errors, AMS)
- Story 2.3: Command builders (pause/resume/stop, set_temp, etc)
- Ref: `docs/references/openbambuapi/` (copiar mqtt.md do Doridian pra repo)

### Epic 3: Bridge Agent
- Story 3.1: MQTT client (`mqtt.js` + TLS) conectando em 1 impressora
- Story 3.2: Integração com `@printstudio/bambu-protocol`
- Story 3.3: SQLite local + histórico de jobs
- Story 3.4: WebSocket outbound pra cloud
- Story 3.5: Endpoint `/api/health` + descoberta mDNS
- Story 3.6: go2rtc integrado pra câmera (RTSP → WebRTC)

### Epic 3: Backend Cloud
- Story 3.1: Fastify API + Supabase client
- Story 3.2: WebSocket relay (bridge ↔ PWA)
- Story 3.3: REST endpoints (printers, jobs, events)
- Story 3.4: Comandos (pause/resume/cancel) → relay pro bridge

### Epic 4: Frontend PWA
- Story 4.1: Setup Next.js + shadcn + auth
- Story 4.2: Detector dual-mode (LAN vs Cloud)
- Story 4.3: Dashboard com 3 cards real-time
- Story 4.4: Detalhe da impressora + câmera WebRTC
- Story 4.5: Histórico de prints
- Story 4.6: PWA manifest + service worker

### Epic 5: Notificações
- Story 5.1: Event dispatcher no bridge
- Story 5.2: Webhook n8n → Telegram
- Story 5.3: Settings page pra cadastrar chat_id

### Epic 6: Hardening
- Story 6.1: Error handling + retry logic (MQTT desconexão)
- Story 6.2: Logs estruturados (pino)
- Story 6.3: Testes E2E críticos (Playwright)
- Story 6.4: Docs de setup (Raspberry Pi bootstrap)

**Estimativa total MVP: 4-6 semanas solo, ~2-3 semanas com @dev.**

---

## 8. Estrutura de Pastas (Monorepo)

```
printstudio/
├── apps/
│   ├── bridge/              # Agent local (MQTT + API + go2rtc)
│   │   ├── src/
│   │   │   ├── mqtt/        # Conexão com as A1
│   │   │   ├── api/         # Endpoints Fastify
│   │   │   ├── ws/          # WebSocket handlers
│   │   │   ├── storage/     # SQLite
│   │   │   └── camera/      # go2rtc wrapper
│   │   └── package.json
│   ├── api/                 # Backend cloud
│   │   └── src/
│   └── web/                 # Next.js PWA
│       └── src/
├── packages/
│   ├── shared/              # Types globais, schemas Zod, utils, WS messages
│   ├── bambu-protocol/      # MQTT topics/payloads da Bambu (spec OpenBambuAPI)
│   ├── db/                  # Drizzle ORM schema + client (api + web usam)
│   └── ui/                  # shadcn components compartilhados (futuro)
├── docs/
│   ├── architecture/        # Este doc
│   ├── stories/             # Stories numeradas (AIOX)
│   └── guides/              # Setup Raspberry, etc
├── supabase/
│   └── migrations/
└── package.json (pnpm workspace)
```

---

## 9. Riscos & Mitigações

| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| Protocolo Bambu muda (firmware update) | Alto | Isolar lógica MQTT em `packages/bambu-protocol`; versionar |
| Latência cloud em comandos críticos | Médio | Sempre executar comandos via bridge local (cloud só faz relay) |
| Desconexão bridge ↔ cloud | Médio | Reconnect automático + heartbeat + buffer local |
| Stream de câmera pesa rede | Baixo | WebRTC adaptativo; só liga quando usuário abre detalhe |
| Exposição de credenciais (access_code) | Alto | Nunca sair do bridge; cifrar no Supabase com RLS |

---

## 10. Próximos Passos

1. **Validar este doc** com o @pm (Morgan) ou direto com você → ajustes se necessário
2. **Criar PRD formal** (`@pm *create-prd`) pra oficializar escopo do MVP
3. **Shardar em epics/stories** (`@po`)
4. **Story 1.1 no @sm** (Setup monorepo) e bora codar com @dev

---

**Fim do documento — pronto pra revisão.** 🏗️
