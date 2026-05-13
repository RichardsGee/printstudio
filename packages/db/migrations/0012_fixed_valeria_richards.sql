CREATE TYPE "public"."waitlist_role" AS ENUM('hobbyist', 'small_shop', 'studio', 'business', 'other');--> statement-breakpoint
CREATE TYPE "public"."waitlist_status" AS ENUM('new', 'contacted', 'engaged', 'invited', 'converted', 'lost');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "invite_tokens" (
	"token" text PRIMARY KEY NOT NULL,
	"waitlist_id" uuid,
	"used_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "waitlist" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"bambu_count" integer NOT NULL,
	"role" "waitlist_role" DEFAULT 'other' NOT NULL,
	"state" text,
	"city" text,
	"telegram_handle" text,
	"phone" text,
	"status" "waitlist_status" DEFAULT 'new' NOT NULL,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"notes" text,
	"contacted_at" timestamp with time zone,
	"last_contact_at" timestamp with time zone,
	"source_utm" jsonb,
	"referrer" text,
	"user_agent" text,
	"ip_address" "inet",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "waitlist_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "onboarding_step" text DEFAULT 'profile' NOT NULL;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "onboarding_completed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "role" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "state" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "city" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "plan" text DEFAULT 'free' NOT NULL;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "waitlist_id" uuid;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "invite_tokens" ADD CONSTRAINT "invite_tokens_waitlist_id_waitlist_id_fk" FOREIGN KEY ("waitlist_id") REFERENCES "public"."waitlist"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
-- Indexes recomendados pela Aria (story 7.3 + 8.2)
CREATE INDEX IF NOT EXISTS "waitlist_created_at_idx" ON "waitlist" ("created_at" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "waitlist_status_idx" ON "waitlist" ("status", "created_at" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "waitlist_state_idx" ON "waitlist" ("state") WHERE "state" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "waitlist_tags_idx" ON "waitlist" USING gin ("tags");
--> statement-breakpoint
-- Index pra rate limit lookup (ip + recent timeframe)
CREATE INDEX IF NOT EXISTS "waitlist_ip_recent_idx" ON "waitlist" ("ip_address", "created_at" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invite_tokens_waitlist_idx" ON "invite_tokens" ("waitlist_id");
--> statement-breakpoint
-- Index parcial: só rows com waitlist_id (Aria recommendation)
CREATE INDEX IF NOT EXISTS "organizations_waitlist_id_idx" ON "organizations" ("waitlist_id") WHERE "waitlist_id" IS NOT NULL;
