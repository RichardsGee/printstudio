# Tech Validation — Epic 7 (Phase 1) + dependências futuras

**Owner:** Aria (Architect)
**Status:** Ready for @dev
**Criado:** 2026-05-13
**Scope:** Stack apps/marketing, schemas waitlist+onboarding, idempotência Asaas, admin protection, Bambu rate limits

---

## Sumário executivo

| # | Frente | Veredicto | Blocker? |
|---|--------|----------|----------|
| 1 | Stack `apps/marketing/` (story 7.1) | ✅ Approved com ajustes | Não |
| 2 | Schema waitlist + invite_tokens (7.3, 8.2) | ✅ Approved com 1 ajuste | Não |
| 3 | Asaas webhook idempotência (6.6) | ⚠️ Approved com extensions | Não |
| 4 | Admin protection middleware (9.1) | ⚠️ Approved — security CRITICAL pattern | Não |
| 5 | Bambu rate limit cache (8.4/8.5) | ✅ Reusa pattern existente | Não |

**Conclusão:** **0 blockers.** @dev pode começar Phase 1 (Epic 7) imediatamente seguindo recomendações abaixo.

---

## 1. Stack `apps/marketing/` — ✅ Approved com ajustes

### Análise

A escolha de **Next.js separado com `output: 'export'`** está correta:
- Performance excellent (static = CDN-friendly)
- SEO friendly (HTML pre-rendered)
- Deploy simples (qualquer servidor estático)
- Reuso do mesmo dev workflow já estabelecido

### Trade-offs identificados

| Trade-off | Análise | Decisão |
|-----------|---------|---------|
| **Duplicação de tema Mission Control** | `mission-control.css` precisa estar em ambos `apps/web` e `apps/marketing` | V1: copy literal. **V1.1: extrair para `packages/ui`** (story futura) |
| **Componentes shared (Button, Card)** | Mesmo problema. Copy ou shared? | V1: copy seletivo (só 2-3 componentes). V1.1: `packages/ui` |
| **Branding drift** | Se tema evoluir, dois lugares pra atualizar | Documentar processo de sync + criar `packages/ui` como story V1.1 |
| **Static vs SSR** | Sem SSR perde flexibilidade futura | V1 OK (landing é estática). Se precisar dados dinâmicos no marketing (ex: contador de leads), migrar pra ISR |

### Recomendação concreta pra @dev

**Story 7.1 — Setup `apps/marketing/`:**

```bash
# Estrutura final esperada
apps/
  marketing/
    package.json           # @printstudio/marketing
    next.config.mjs        # output: 'export'
    tailwind.config.ts     # COPY de apps/web (V1)
    postcss.config.mjs
    tsconfig.json
    Dockerfile
    nginx.conf             # serve static do /out
    src/
      app/
        layout.tsx
        page.tsx
        globals.css        # COPY de apps/web (V1)
        mission-control.css # COPY de apps/web (V1)
        sucesso/page.tsx
        politica-de-privacidade/page.tsx
        termos-de-uso/page.tsx
      components/
        ui/                # COPY seletivo: button, card, input, label, dialog
        marketing-header.tsx
        hero.tsx
        feature-card.tsx
        waitlist-form.tsx
        demo-modal.tsx
        footer.tsx
        success-confirmation.tsx
```

**Próxima ação @devops:** adicionar `apps/marketing` em `pnpm-workspace.yaml` — **já contemplado pelo glob `apps/*`**.

### Dockerfile recomendado (story 7.6)

Reusar pattern multi-stage do `apps/web/Dockerfile` adaptado pra serve static:

```dockerfile
FROM node:20-alpine AS deps
WORKDIR /repo
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* tsconfig.base.json ./
COPY apps/marketing ./apps/marketing
RUN corepack enable && pnpm install --frozen-lockfile

FROM deps AS builder
WORKDIR /repo
RUN pnpm --filter @printstudio/marketing build

FROM nginx:alpine AS runner
COPY --from=builder /repo/apps/marketing/out /usr/share/nginx/html
COPY apps/marketing/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

`nginx.conf` mínimo com:
- `try_files $uri $uri.html $uri/ /index.html`
- Security headers (CSP, X-Frame-Options, etc)
- Caching (`Cache-Control: max-age=31536000, immutable` em `/static/*`)
- `Cache-Control: no-cache` em HTML pra deploys rápidos

### Open question pra @dev

- **API endpoint do form:** marketing static não tem backend próprio. Form precisa chamar endpoint público do `apps/api`. Recomendação: criar **rota dedicada** `POST /api/public/waitlist` em `apps/api` com CORS aberto pra `guiaprint3d.com` + `localhost:3002`.

---

## 2. Schema waitlist + invite_tokens — ✅ Approved (1 ajuste)

### Análise dos schemas propostos

| Tabela | Veredicto | Notas |
|--------|----------|-------|
| `waitlist` | ✅ Approved | Enums + indexes + campos CRM-light corretos |
| `invite_tokens` | ✅ Approved | FK cascade OK, expires_at NOT NULL OK |
| `organizations` alterations | ⚠️ 1 ajuste | Ver abaixo |

### Ajuste único

**`organizations.waitlist_id`** com `REFERENCES waitlist(id) ON DELETE SET NULL`:

- ✅ Mantém histórico se waitlist apagado (org sobrevive)
- ⚠️ **MAS:** índice precisa ser **NULLABLE-friendly**. Drizzle gera index padrão que pode incluir NULLs — adicionar `WHERE waitlist_id IS NOT NULL` no index pra otimizar lookup:

```sql
-- Em vez do default
CREATE INDEX organizations_waitlist_id_idx
  ON organizations (waitlist_id)
  WHERE waitlist_id IS NOT NULL;
```

### Migration order — RECOMENDADO

**Consolidar Phase 1 + Phase 2 schema em UMA migration** (`0012_waitlist_onboarding.sql`):

```
waitlist (story 7.3) +
invite_tokens (story 8.2) +
organizations.{onboarding_step, role, state, city, plan, waitlist_id} (story 8.2)
```

**Por quê:**
- Stories 7.3 e 8.2 são prerequisitos cruzados (signup com invite precisa de ambos)
- 1 migration evita drift entre dev/prod
- @dev aplica 1x e tudo funciona

**Ordem dependências dentro da migration:**
1. `CREATE TYPE waitlist_status, waitlist_role`
2. `CREATE TABLE waitlist`
3. `ALTER TABLE organizations ADD COLUMN ...` (vários — incluindo `waitlist_id`)
4. `CREATE TABLE invite_tokens` (depende de waitlist via FK)
5. `CREATE INDEX ...` (todos os indexes)

### Sobre token format (invite_tokens)

| Opção | Análise | Veredicto |
|-------|---------|-----------|
| `nanoid(32)` | URL-safe, ~190 bits, simples | ✅ Recomendado |
| `ulid()` | Sortable, ~128 bits + timestamp | ⚠️ Não precisa V1 (sem use case) |
| `crypto.randomBytes(32).toString('base64url')` | Stdlib node, sem dep | ✅ Alternativa |

**Recomendação:** `crypto.randomBytes(24).toString('base64url')` (32 chars URL-safe, zero dep extra).

### Open question pra @dev

- **Token reuse:** se admin gera token pra mesma lead 2x, antigo invalida ou ambos válidos? **Decisão recomendada:** invalidar antigo (`UPDATE invite_tokens SET used_at = now() WHERE waitlist_id = $1 AND used_at IS NULL`) — evita confusão de "qual link mando?"

---

## 3. Asaas webhook idempotência — ⚠️ Approved com extensions

### Análise

Esquema `asaas_webhook_events` com `event_id UNIQUE` está correto. Adicionar:

```sql
-- Schema extension recomendada
ALTER TABLE asaas_webhook_events ADD COLUMN processing_status text
  DEFAULT 'pending' NOT NULL;
-- valores: 'pending' | 'processing' | 'done' | 'error'

ALTER TABLE asaas_webhook_events ADD COLUMN retry_count integer
  DEFAULT 0 NOT NULL;

CREATE INDEX asaas_events_pending_idx ON asaas_webhook_events (processing_status, created_at)
  WHERE processing_status IN ('pending', 'error');
```

### Process inline V1 vs queue

| Aspecto | Inline V1 | Queue dedicada |
|---------|-----------|----------------|
| Setup | Zero | Redis + worker |
| Latência | <2s ack ao Asaas | Variável |
| Retry granular | Manual | Built-in |
| Recovery após crash | Re-process via processing_status | Job runner cuida |

**Veredicto:** **Inline V1 OK** com:
- `processing_status` pra recovery
- Cron diário (worker) reprocesses `WHERE processing_status='error' AND retry_count<3`
- Migrar pra BullMQ/Inngest V2 quando volume justificar (>1k webhooks/dia)

### HMAC + retry strategy

```typescript
// Pseudo-código pra story 6.6
import { timingSafeEqual } from 'node:crypto';

// HMAC validation
const expected = req.headers['asaas-access-token'];
const actual = process.env.ASAAS_WEBHOOK_TOKEN!;
if (!timingSafeEqual(Buffer.from(expected), Buffer.from(actual))) {
  return reply.code(401).send({ error: 'invalid_signature' });
}

// Retry com jitter
const delays = [1000, 2000, 4000, 8000]; // ms
const jitter = () => 0.8 + Math.random() * 0.4; // ±20%

for (let attempt = 0; attempt < 3; attempt++) {
  try {
    await processEvent(event);
    return;
  } catch (err) {
    if (attempt < 2) {
      await sleep(delays[attempt] * jitter());
      continue;
    }
    // Após 3 tentativas, marca error pra cron retentar depois
    await db.update(asaasWebhookEvents)
      .set({ processing_status: 'error', retry_count: attempt + 1 })
      .where(eq(asaasWebhookEvents.id, eventId));
  }
}
```

### Open question pra @dev

- **Webhook URL no painel Asaas:** quando deploy, registrar `https://api.guiaprint3d.com/api/asaas/webhook` (ou similar). @devops vai configurar quando Phase 3 chegar.

---

## 4. Admin protection middleware — ⚠️ Approved (SECURITY CRITICAL pattern)

### Privilege escalation prevention — pattern obrigatório

**A flag `is_super_admin` NUNCA pode ser editável via API normal.** Implementar **defense in depth**:

#### Layer 1 — Zod schema strict

```typescript
// packages/shared/src/user.ts
export const UpdateUserSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  email: z.string().email().optional(),
  // is_super_admin: AUSENTE — Zod parse strip campos não declarados
}).strict(); // .strict() rejeita campos extras com error

// Server action ou route handler
const result = UpdateUserSchema.safeParse(req.body);
if (!result.success) return reply.code(400).send({ error: 'invalid_payload' });
// result.data NÃO TEM is_super_admin, mesmo se veio no body
```

#### Layer 2 — TypeScript type guard

```typescript
// PATCH /api/users/:id
export async function PATCH(req) {
  const data = UpdateUserSchema.parse(req.body); // Strip extra fields
  // data tem TYPE explicitamente sem is_super_admin
  await db.update(users)
    .set({ name: data.name, email: data.email, updatedAt: new Date() }) // EXPLICIT fields
    .where(eq(users.id, req.params.id));
}
```

#### Layer 3 — Função dedicada pra promoção

```typescript
// CLI-only ou seeder
export async function setSuperAdmin(email: string) {
  await db.update(users)
    .set({ is_super_admin: true })
    .where(eq(users.email, email));
}

// Documentar em docs/architecture/admin-setup.md:
// "Para promover novo super_admin, rodar manualmente:
//  pnpm tsx packages/db/scripts/promote-admin.ts <email>"
```

#### Layer 4 — Test obrigatório

```typescript
// Story 9.1 quality gate
test('PATCH /api/users/:id NÃO permite escalation', async () => {
  const response = await request(app)
    .patch(`/api/users/${userId}`)
    .send({ name: 'X', is_super_admin: true });

  expect(response.status).toBe(200);
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  expect(user.is_super_admin).toBe(false); // Flag NÃO foi alterada
});
```

### Middleware /admin/* — pattern recomendado

**2-layer check** (Next.js middleware Edge + server component DB lookup):

```typescript
// apps/web/src/middleware.ts
import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function middleware(req: NextRequest) {
  if (!req.nextUrl.pathname.startsWith('/admin')) return NextResponse.next();

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) {
    // Não logado → 404 (não 403/302, esconde existência)
    return NextResponse.rewrite(new URL('/404', req.url));
  }

  // Edge middleware NÃO faz DB query (Edge runtime limit)
  // Verifica claim is_super_admin no JWT (precisa ser embedded no token)
  if (!token.is_super_admin) {
    return NextResponse.rewrite(new URL('/404', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};
```

```typescript
// apps/web/src/app/(admin)/layout.tsx
// Layer 2: server component faz DB lookup (defense in depth)
import { notFound } from 'next/navigation';
import { auth } from '@/lib/auth';

export default async function AdminLayout({ children }) {
  const session = await auth();
  if (!session?.user) notFound();

  const user = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
    columns: { is_super_admin: true },
  });

  if (!user?.is_super_admin) notFound(); // 404

  return <>{children}</>;
}
```

**Por quê 2 layers:**
- Middleware Edge é **rápido** (sem DB) mas confia no JWT
- Server component **confirma no DB** (caso JWT esteja stale)
- Se um falhar, o outro pega

### NextAuth callback — incluir is_super_admin no JWT

```typescript
// apps/web/src/lib/auth.ts
export const { auth, handlers } = NextAuth({
  callbacks: {
    jwt: async ({ token, user, trigger }) => {
      if (user) {
        token.id = user.id;
        // Fetch is_super_admin do DB ao criar token
        const dbUser = await db.query.users.findFirst({
          where: eq(users.id, user.id),
          columns: { is_super_admin: true },
        });
        token.is_super_admin = dbUser?.is_super_admin ?? false;
      }
      return token;
    },
    session: async ({ session, token }) => {
      session.user.id = token.id as string;
      // NÃO expor is_super_admin no client session
      // (server-side only via JWT)
      return session;
    },
  },
});
```

**Importante:** `is_super_admin` fica **só no JWT/server**, não na `session` exposta ao client. Frontend nunca precisa saber.

---

## 5. Bambu rate limit cache — ✅ Reusa pattern existente

### Boa notícia

Pattern correto **JÁ EXISTE** no projeto:

| Local | Pattern |
|-------|---------|
| `apps/worker/src/task-resolver.ts` | `cache = new Map<string, TaskPreview>()` per-printer |
| `apps/api/src/services/bambu-cloud.ts` | `BambuCloudError('BAMBU_RATE_LIMITED', ...)` handling |
| `bambu_credentials` table | Tokens encrypted + per-org |

### Análise volume Phase 2

Com **50-200 signups/dia**, cada vinculação faz tipicamente:
- 1 chamada `/auth/sendCode` (email)
- 1 chamada `/auth/verifyCode` (POST código)
- 1 chamada `/devices` (listar impressoras)

= **3 calls × 100 signups/dia médio = 300 calls/dia** = ~12 calls/hora pico.

Bambu Cloud rate limit não está publicamente documentado mas typical é 60-120/min. **Folga grande.**

### Recomendações concretas pra story 8.4

```typescript
// apps/web/src/lib/bambu-onboarding.ts (NOVO — wrapper sobre services existentes)
import { withRetry } from '@/lib/retry';

export async function listDevicesForOrg(orgId: string) {
  return withRetry(
    () => bambuCloudService.listDevices(orgId),
    {
      maxAttempts: 3,
      delays: [1000, 2000, 4000], // ms
      jitter: 0.2,
      retryOn: (err) => err.code === 'BAMBU_RATE_LIMITED',
    }
  );
}
```

```typescript
// apps/web/src/lib/retry.ts (NOVO — utility shared)
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: { maxAttempts: number; delays: number[]; jitter: number; retryOn: (err: any) => boolean }
): Promise<T> {
  let lastError;
  for (let i = 0; i < opts.maxAttempts; i++) {
    try { return await fn(); }
    catch (err) {
      lastError = err;
      if (i === opts.maxAttempts - 1 || !opts.retryOn(err)) throw err;
      const delay = opts.delays[i] * (1 - opts.jitter + Math.random() * opts.jitter * 2);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw lastError;
}
```

### Open question pra @dev

- **Queue dedicada V1?** Não necessário. Adicionar quando >500 signups/dia OU se rate limit Bambu virar problema real (medir antes de otimizar).

---

## 🚦 Quality Gates pra @dev (checklist arquitetural)

### Antes de marcar Story 7.x ou 8.x como Done

- [ ] `apps/marketing` adicionado em workspace + builds standalone
- [ ] `mission-control.css` copiado (V1) com comentário "TODO V1.1: extrair pra packages/ui"
- [ ] Migration consolidada `0012_waitlist_onboarding.sql` aplicada
- [ ] Index parcial `organizations_waitlist_id_idx WHERE waitlist_id IS NOT NULL`
- [ ] `crypto.randomBytes(24).toString('base64url')` pra invite tokens
- [ ] Token reuse invalida antigo
- [ ] CORS no `/api/public/waitlist` aceita `guiaprint3d.com` + localhost dev

### Antes de marcar Story 6.6 (Asaas webhook) como Done

- [ ] Schema `processing_status` + `retry_count` adicionados
- [ ] `crypto.timingSafeEqual()` na validação HMAC
- [ ] Retry com backoff exponencial + jitter (3 attempts)
- [ ] Cron diário reprocessa erros
- [ ] Test idempotência: replay 2× → 1 invoice (não 2)

### Antes de marcar Story 9.1 (admin protection) como Done

- [ ] Zod `.strict()` no UpdateUserSchema
- [ ] Função `setSuperAdmin()` separada, NÃO exposta via API
- [ ] Middleware `/admin/*` com JWT check (Edge)
- [ ] Layout `(admin)/layout.tsx` com DB lookup (defense in depth)
- [ ] Test escalation: PATCH com `is_super_admin: true` → flag não muda
- [ ] `is_super_admin` no JWT mas NÃO na session client-exposed
- [ ] 404 (não 403) pra non-admin

### Antes de marcar Story 8.4/8.5 (Bambu onboarding) como Done

- [ ] Reusa `apps/api/src/services/bambu-cloud.ts`
- [ ] Wrapper `withRetry` aplicado em chamadas críticas
- [ ] Backoff 1s/2s/4s com ±20% jitter
- [ ] Retry só em `BAMBU_RATE_LIMITED`, não em outros erros

---

## 📋 Open questions pra @dev (consolidadas)

| # | Pergunta | Recomendação default |
|---|----------|----------------------|
| 1 | API endpoint do waitlist form | `POST /api/public/waitlist` em `apps/api` |
| 2 | Token reuse strategy | Invalidar antigo ao gerar novo |
| 3 | Webhook URL pro Asaas painel | `https://api.guiaprint3d.com/api/asaas/webhook` (config Phase 3) |
| 4 | Queue dedicada pra Bambu? | Não V1. Adicionar quando >500 signups/dia |
| 5 | packages/ui shared library | V1.1 (após landing live + medir drift) |

**Default acceptance:** se @dev seguir recomendações default, considerar approved. Se houver desvio, registrar em ADR (Architecture Decision Record).

---

## 🗓️ Próximos passos

1. **@dev (Dex)** começa Phase 1 — recomendação ordem:
   ```
   1ª — Story 7.3 (API + schema consolidado)
   2ª — Story 7.1 (apps/marketing setup)
   3ª — Story 7.4 (privacy/terms)
   4ª — Story 7.2 (landing page)
   5ª — Story 7.5 (success page)
   6ª — Story 7.6 (deploy + DNS — depende guiaprint3d.com registrado)
   ```

2. **Após Phase 1 visível em prod**, retomar validação técnica items 3/4/5 com profundidade (Asaas, Admin, Bambu rate)

3. **@devops** documenta processo de deploy do marketing site no EasyPanel (story 7.6)

4. **Richard** registra `guiaprint3d.com` quando deploy estiver pronto (decisão própria — só quando lançar)

---

## Changelog

- **2026-05-13:** Criado por Aria — validação técnica das 5 frentes. Status: Approved (0 blockers). 5 open questions documentadas com defaults recomendados.

— Aria, arquitetando o futuro 🏗️
