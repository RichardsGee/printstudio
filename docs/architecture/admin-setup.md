# Admin Setup — Super Admin Promotion

> Story 9.1 · Epic 9 — Internal Admin Panel

O Admin Panel (`/admin/*`) é protegido por um flag boolean
`users.is_super_admin`. Decisão fechada PRD 9: **single super_admin
V1** (só Richard).

A flag **NUNCA** é editável via API. Promoção é manual via SQL direto
no Postgres.

## Como promover um user a super_admin

### 1. Em produção (EasyPanel Postgres)

```sql
UPDATE users
SET is_super_admin = true
WHERE email = 'richardsgee69@gmail.com';
```

Confirma:

```sql
SELECT id, email, name, is_super_admin
FROM users
WHERE is_super_admin = true;
```

### 2. Em dev local

```bash
psql "$DATABASE_URL" -c "UPDATE users SET is_super_admin = true WHERE email = 'meu-email@dev.com';"
```

## Como revogar super_admin

```sql
UPDATE users
SET is_super_admin = false
WHERE email = '<email>';
```

Cache: o `requireSuperAdmin()` helper consulta o DB a cada request
(sem cache). Revogação é **imediata** — próximo request pra `/admin/*`
retorna 404.

## Comportamento da rota `/admin/*`

- User SEM session → `notFound()` (404)
- User SEM `is_super_admin = true` → `notFound()` (404)
- User COM flag → renderiza normal

Decisão deliberada: retornar 404 (não 403) esconde existência da rota
de usuários comuns. É security-through-obscurity em camada extra (a
defesa primária é a flag no DB).

## Garantias contra privilege escalation

1. **Endpoint PATCH /api/users/:id** usa Zod `.strict()` — rejeita
   QUALQUER campo fora do whitelist permitido (`name`,
   `notificationChannels`). Tentativas de setar `is_super_admin`,
   `role`, `passwordHash`, `email` ou `id` resultam em 400.
2. **Logging de auditoria**: tentativas explícitas (palavras-chave
   `isSuperAdmin`/`is_super_admin`/`role`/`passwordHash`/`email`/`id`
   no body) disparam `logger.warn` com `event: 'users.escalation_attempt'`.
3. **Ownership**: user só pode patchar a si próprio. Admin Panel
   eventualmente expõe PATCH a super-admin via endpoint dedicado
   (Story 9.5+).
4. **Tests unitários** (`apps/api/src/routes/users.test.ts`):
   10 testes cobrindo escalation attempts (camelCase, snake_case,
   bypass attempts via __proto__, etc).

## V1.1 / V2 evolução

- **Multi super-admin**: schema já suporta. Basta promover múltiplos
  users.
- **Admin secundário com permissões granulares**: Story futura
  introduz tabela `admin_permissions` com RBAC. Por enquanto é
  binário (super_admin OU não).
- **2FA pra super-admin**: V1.1 quando entrar 2FA geral no produto.

## Migração 0014

```bash
# Migration 0014_super_admin.sql adiciona:
# - users.is_super_admin boolean DEFAULT false NOT NULL
# - users_super_admin_idx (parcial WHERE is_super_admin = true)
#
# Em prod:
psql "$DATABASE_URL" -f packages/db/migrations/0014_super_admin.sql

# Verifica:
psql "$DATABASE_URL" -c "\d users" | grep is_super_admin
```

## Acesso rápido (cheat sheet)

| Ação | Comando |
|------|---------|
| Promover | `UPDATE users SET is_super_admin = true WHERE email = '...';` |
| Revogar | `UPDATE users SET is_super_admin = false WHERE email = '...';` |
| Listar | `SELECT email FROM users WHERE is_super_admin = true;` |
| Acessar | `https://app.guiaprint3d.com/admin` (logado como super_admin) |
