ALTER TABLE "printer_state" ADD COLUMN "fan_heatbreak_pct" integer;--> statement-breakpoint
ALTER TABLE "printer_state" ADD COLUMN "door_open" boolean;--> statement-breakpoint
ALTER TABLE "printer_state" ADD COLUMN "is_from_sd_card" boolean;--> statement-breakpoint
ALTER TABLE "printer_state" ADD COLUMN "lifecycle" text;--> statement-breakpoint
ALTER TABLE "printer_state" ADD COLUMN "print_type" text;--> statement-breakpoint
ALTER TABLE "printer_state" ADD COLUMN "print_error_code" integer;--> statement-breakpoint
ALTER TABLE "printer_state" ADD COLUMN "state_change_reason" text;