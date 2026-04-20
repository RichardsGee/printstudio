# EasyPanel Setup — PrintStudio

Guia de deploy no EasyPanel. Ordem sugerida de criação dos services.

---

## 1. Criar o Project

No EasyPanel → **Create Project** → nome: `printstudio`.

---

## 2. Service: PostgreSQL

**Type:** Database → PostgreSQL 16

| Config | Valor |
|--------|-------|
| Service name | `postgres` |
| Database | `printstudio` |
| Username | `printstudio` |
| Password | (gerar forte — salvar num gerenciador) |
| Port | `5432` (interno) |

**Conexão interna (usar nos outros services):**
```
postgresql://printstudio:SENHA@printstudio_postgres:5432/printstudio
```

**Backup:** ativar backup diário no EasyPanel.

---

## 3. Service: API (Backend)

**Type:** App → From Git

| Config | Valor |
|--------|-------|
| Service name | `api` |
| Repo | (preencher quando criar o repo GitHub) |
| Branch | `main` |
| Build path | `apps/api` |
| Port | `4000` |
| Dockerfile | `apps/api/Dockerfile` |

**Env vars (EasyPanel → api → Environment):**
```
NODE_ENV=production
LOG_LEVEL=info
DATABASE_URL=postgresql://printstudio:SENHA@printstudio_postgres:5432/printstudio
AUTH_SECRET=(openssl rand -base64 32)
API_PORT=4000
API_CORS_ORIGIN=http://SEU_IP:3000
CLOUD_API_TOKEN=(gerar token forte — mesmo do bridge)
```

**Domínio:** sem domínio por enquanto → usar IP:4000 direto.

---

## 4. Service: Web (PWA)

**Type:** App → From Git

| Config | Valor |
|--------|-------|
| Service name | `web` |
| Repo | (mesmo repo) |
| Build path | `apps/web` |
| Port | `3000` |
| Dockerfile | `apps/web/Dockerfile` |

**Env vars:**
```
NODE_ENV=production
NEXT_PUBLIC_API_URL=http://SEU_IP:4000
NEXT_PUBLIC_WS_URL=ws://SEU_IP:4000/ws/client
NEXT_PUBLIC_LAN_DISCOVERY_HOST=printstudio.local
NEXT_PUBLIC_LAN_DISCOVERY_PORT=8080
AUTH_SECRET=(mesmo do API)
AUTH_URL=http://SEU_IP:3000
DATABASE_URL=postgresql://printstudio:SENHA@printstudio_postgres:5432/printstudio
```

---

## 5. Service: n8n (opcional — pra notificações)

Se ainda não tem, EasyPanel tem template pronto:
**Create Service → Template → n8n**.

---

## 6. Bridge Agent (NÃO vai no EasyPanel)

Roda **no seu PC local** — não é um service do EasyPanel.

```bash
# No seu PC:
cd apps/bridge
cp .env.example .env
# preencher credenciais das impressoras + CLOUD_WS_URL apontando pro API do EasyPanel
npm install
npm run dev     # ou pm2 start ecosystem.config.js em modo produção
```

**Importante:** o bridge fica permanentemente conectado via WebSocket **outbound** ao API do EasyPanel — isso significa **não precisa abrir portas** no seu roteador.

---

## 7. Checklist pós-deploy

- [ ] Postgres online e aceitando conexões internas
- [ ] API respondendo em `http://SEU_IP:4000/api/health`
- [ ] Web carregando em `http://SEU_IP:3000`
- [ ] Bridge no PC local conectando no API (verificar logs do API)
- [ ] Consegue ver estado real-time das 3 A1 no dashboard

---

## 8. Quando tiver domínio (futuro)

No EasyPanel, cada service tem aba **Domains**:
1. Adicionar domínio → ativa Let's Encrypt automático
2. Atualizar env vars:
   - `API_CORS_ORIGIN` → `https://app.printstudio.seudominio.com`
   - `NEXT_PUBLIC_API_URL` → `https://api.printstudio.seudominio.com`
   - `NEXT_PUBLIC_WS_URL` → `wss://...` (note o `wss`)
   - `AUTH_URL` → `https://app...`
3. Redeploy
