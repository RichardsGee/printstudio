-- Migration 0009: cached_models — mesh 3D vinculado ao bambu_model_id (Story 4.8)
--
-- Permite que o user uploade um .3mf 1 vez por modelo Bambu Cloud e
-- futuras impressões do mesmo modelo reusem automaticamente o mesh
-- pra renderização 3D rotacionável no kiosk.

CREATE TABLE IF NOT EXISTS "cached_models" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "bambu_model_id" text NOT NULL,
  "filename" text NOT NULL,
  "size_bytes" integer NOT NULL,
  "mesh_payload" jsonb NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "cached_models_org_model_unique" UNIQUE ("organization_id", "bambu_model_id")
);
