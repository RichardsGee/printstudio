-- Migration 0006: Bambu Cloud credentials encrypted at rest (Epic 4 / Story 4.3)
--
-- Tokens (access + refresh) são AES-256-GCM encryptados com a chave
-- BAMBU_CRED_KEY (env var, 32 bytes base64). Helpers em
-- packages/db/src/crypto.ts.
--
-- UNIQUE (organization_id) → 1 conta Bambu por org no v1.

CREATE TABLE IF NOT EXISTS "bambu_credentials" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" uuid NOT NULL UNIQUE
    REFERENCES "organizations"("id") ON DELETE CASCADE,
  "bambu_email" text NOT NULL,
  "bambu_user_id" text NOT NULL,
  "encrypted_access_token" bytea NOT NULL,
  "encrypted_refresh_token" bytea,
  "access_token_expires_at" timestamptz NOT NULL,
  "last_synced_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
