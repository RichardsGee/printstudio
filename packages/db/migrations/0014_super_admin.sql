ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_super_admin" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_super_admin_idx" ON "users" USING btree ("is_super_admin") WHERE "users"."is_super_admin" = true;
