-- Story 5.4 — Reorder manual das impressoras no /kiosk.
-- display_order: NULL = sem ordem manual (fallback createdAt ASC).
--                INT  = posição manual (lower = primeiro).
ALTER TABLE "printers" ADD COLUMN "display_order" integer;

-- Index parcial: só registros com ordem manual entram no index, otimiza
-- ORDER BY display_order ASC NULLS LAST.
CREATE INDEX IF NOT EXISTS "printers_display_order_idx"
  ON "printers" ("organization_id", "display_order")
  WHERE "display_order" IS NOT NULL;
