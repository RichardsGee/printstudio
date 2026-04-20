ALTER TABLE "printer_state" ADD COLUMN "active_slot_index" integer;--> statement-breakpoint
ALTER TABLE "printer_state" ADD COLUMN "speed_mode" text;--> statement-breakpoint
ALTER TABLE "printer_state" ADD COLUMN "speed_percent" numeric(5, 1);--> statement-breakpoint
ALTER TABLE "printer_state" ADD COLUMN "wifi_signal_dbm" integer;--> statement-breakpoint
ALTER TABLE "printer_state" ADD COLUMN "fan_part_cooling_pct" integer;--> statement-breakpoint
ALTER TABLE "printer_state" ADD COLUMN "fan_aux_pct" integer;--> statement-breakpoint
ALTER TABLE "printer_state" ADD COLUMN "fan_chamber_pct" integer;--> statement-breakpoint
ALTER TABLE "printer_state" ADD COLUMN "nozzle_diameter" text;--> statement-breakpoint
ALTER TABLE "printer_state" ADD COLUMN "nozzle_type" text;--> statement-breakpoint
ALTER TABLE "printer_state" ADD COLUMN "stage" text;