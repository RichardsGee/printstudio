-- Migration 0010: Mesh cached por plate + plate atual no state (Story 4.9)
--
-- Antes: 1 mesh por (org, bambu_model_id) combinando TODOS os plates.
-- Resultado: kiosk mostra plates extras que não estão sendo impressos.
--
-- Agora: 1 mesh por (org, bambu_model_id, plate_index). RealisticPreview3D
-- usa state.current_plate_index pra buscar exatamente o que está na bandeja.

ALTER TABLE "cached_models" ADD COLUMN IF NOT EXISTS "plate_index" integer NOT NULL DEFAULT 1;
--> statement-breakpoint
ALTER TABLE "cached_models" DROP CONSTRAINT IF EXISTS "cached_models_org_model_unique";
--> statement-breakpoint
ALTER TABLE "cached_models"
  ADD CONSTRAINT "cached_models_org_model_plate_unique"
  UNIQUE ("organization_id", "bambu_model_id", "plate_index");
--> statement-breakpoint
ALTER TABLE "printer_state" ADD COLUMN IF NOT EXISTS "current_plate_index" integer;
