-- Migration 0005: Multi-tenant foundation (Epic 4)
--
-- Adiciona organizations + organization_members + organization_id em
-- tabelas de dados. Backfilla TUDO pra uma org "Default" determinística
-- (UUID 00000000-0000-0000-0000-000000000001).
--
-- IMPORTANTE: organization_id é NOT NULL mas com DEFAULT apontando pra
-- org Default. Isso permite que code antigo (que não passa organization_id
-- nos INSERTs) continue funcionando enquanto novo code é deployado.
-- Próximas stories podem remover o DEFAULT depois que tudo passar valor
-- explícito.

-- Enum pra roles na membership
DO $$ BEGIN
  CREATE TYPE "organization_member_role" AS ENUM ('owner', 'admin', 'member');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

-- Tabela organizations
CREATE TABLE IF NOT EXISTS "organizations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" text NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- Tabela organization_members (many-to-many user x org)
CREATE TABLE IF NOT EXISTS "organization_members" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "role" "organization_member_role" NOT NULL DEFAULT 'member',
  "created_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "uq_organization_members_org_user" UNIQUE ("organization_id", "user_id")
);
--> statement-breakpoint

-- Cria org Default (UUID determinístico)
INSERT INTO "organizations" ("id", "name")
VALUES ('00000000-0000-0000-0000-000000000001', 'Default')
ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint

-- Promove todos os users existentes a owner da Default
INSERT INTO "organization_members" ("organization_id", "user_id", "role")
SELECT '00000000-0000-0000-0000-000000000001'::uuid, "id", 'owner'
FROM "users"
ON CONFLICT ("organization_id", "user_id") DO NOTHING;
--> statement-breakpoint

-- Adiciona organization_id com DEFAULT (compat com code antigo)
ALTER TABLE "printers" ADD COLUMN IF NOT EXISTS "organization_id" uuid
  NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::uuid
  REFERENCES "organizations"("id") ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "organization_id" uuid
  NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::uuid
  REFERENCES "organizations"("id") ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE "print_jobs" ADD COLUMN IF NOT EXISTS "organization_id" uuid
  NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::uuid
  REFERENCES "organizations"("id") ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE "temperature_samples" ADD COLUMN IF NOT EXISTS "organization_id" uuid
  NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::uuid
  REFERENCES "organizations"("id") ON DELETE CASCADE;
