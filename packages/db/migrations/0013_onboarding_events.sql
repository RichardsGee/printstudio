CREATE TABLE IF NOT EXISTS "onboarding_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "onboarding_events" ADD CONSTRAINT "onboarding_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "onboarding_events_org_idx" ON "onboarding_events" USING btree ("organization_id","created_at" DESC);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "onboarding_events_type_idx" ON "onboarding_events" USING btree ("event_type","created_at" DESC);
