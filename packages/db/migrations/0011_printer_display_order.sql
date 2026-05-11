-- Story 5.4 — Reorder manual das impressoras no /kiosk.
-- display_order: NULL = sem ordem manual (fallback createdAt ASC).
--                INT  = posição manual (lower = primeiro).
--
-- IF NOT EXISTS porque o ADD COLUMN foi aplicado direto via script
-- antes de gerar a migration via drizzle-kit (hotfix histórico).
ALTER TABLE "printers" ADD COLUMN IF NOT EXISTS "display_order" integer;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "printers_display_order_idx"
  ON "printers" ("organization_id", "display_order")
  WHERE "display_order" IS NOT NULL;
