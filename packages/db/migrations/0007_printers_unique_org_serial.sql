-- Migration 0007: Multi-tenant — UNIQUE composto em printers (Story 4.5b)
--
-- Antes: UNIQUE (serial) → impedia que 2 orgs tivessem a mesma física
-- impressora (caso natural quando worker cloud da Talita Shop tentar
-- upsert um serial que já existe na org Default).
--
-- Agora: UNIQUE (organization_id, serial) → uma impressora física pode
-- existir em até N orgs (uma linha por org), mas dentro de uma org, o
-- serial é único.

ALTER TABLE "printers" DROP CONSTRAINT IF EXISTS "printers_serial_unique";
--> statement-breakpoint
ALTER TABLE "printers"
  ADD CONSTRAINT "printers_organization_id_serial_unique"
  UNIQUE ("organization_id", "serial");
