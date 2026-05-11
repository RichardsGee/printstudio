-- Migration 0008: Cloud auto-preview da impressão atual (Story 4.7)
--
-- Worker resolve a task atual no Bambu Cloud (via /my/tasks) e enriquece
-- bridge.state com 4 campos novos:
--   - current_bambu_model_id: identificador do modelo (chave pra Story 4.8)
--   - current_task_cover_url: PNG plate_1 (pública na CDN MakerWorld)
--   - current_task_top_url:   PNG top_1 (vista superior)
--   - current_task_pick_url:  PNG pick_1 (vista isométrica)
--
-- A UI usa pick_url como fallback do RealisticPreview3D quando não há
-- .3mf cached (Story 4.8). Pra cards do kiosk, cover é o default.

ALTER TABLE "printer_state" ADD COLUMN IF NOT EXISTS "current_bambu_model_id" text;
--> statement-breakpoint
ALTER TABLE "printer_state" ADD COLUMN IF NOT EXISTS "current_task_cover_url" text;
--> statement-breakpoint
ALTER TABLE "printer_state" ADD COLUMN IF NOT EXISTS "current_task_top_url" text;
--> statement-breakpoint
ALTER TABLE "printer_state" ADD COLUMN IF NOT EXISTS "current_task_pick_url" text;
