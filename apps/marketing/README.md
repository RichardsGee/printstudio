# @printstudio/marketing — ⚠️ CÓDIGO CONGELADO (backup)

> **Status:** congelado em 2026-05-14 · não-deployed · mantido como referência.

## Leia antes de editar

A landing pública **não mora mais aqui**. A partir da **Story 7.7**
(2026-05-18) a source-of-truth da landing é:

```
apps/web/src/app/(public)/
```

Servida em `https://criartificial-printstudio.z9ivjr.easypanel.host/`
(rota `/` do `apps/web`). Motivo: `guiaprint3d.com` ainda não foi
registrado e o EasyPanel só tem 1 host ativo, então a landing foi
integrada ao `apps/web` em vez de deploy split (Story 7.6 adiada).

## Por que este diretório ainda existe

Decisão do Richard (Story 7.7, AC 27): **não deletar**. Fica como
backup/referência caso valha voltar pro deploy standalone quando o
domínio próprio for registrado (reativar Story 7.6).

## Se for reativar

Este código está **defasado** em relação ao `apps/web/src/app/(public)/`.
Mudanças feitas na Story 7.7+ (GA4/consent LGPD, FAQ, waitlist wizard
3-step, sticky CTA mobile, hero 3D real) **só existem no `apps/web`**.
Sincronize manualmente — não copie cegamente daqui pra produção.

## Dev local (se precisar rodar o backup)

```bash
pnpm --filter @printstudio/marketing dev   # porta 3002
```
