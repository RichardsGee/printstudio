CREATE TABLE IF NOT EXISTS "temperature_samples" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"printer_id" uuid NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"nozzle_temp" numeric(5, 1),
	"nozzle_target_temp" numeric(5, 1),
	"bed_temp" numeric(5, 1),
	"bed_target_temp" numeric(5, 1),
	"chamber_temp" numeric(5, 1)
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "temperature_samples" ADD CONSTRAINT "temperature_samples_printer_id_printers_id_fk" FOREIGN KEY ("printer_id") REFERENCES "public"."printers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
