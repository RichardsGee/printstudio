/**
 * Raw Bambu MQTT payload types.
 *
 * Bambu publishes JSON payloads under keys like "print", "mc_print", "info",
 * "system", etc. We model only the fields PrintStudio actually uses.
 *
 * Reference: https://github.com/Doridian/OpenBambuAPI/blob/main/mqtt.md
 */

import { z } from 'zod';

export const BambuAmsTraySchema = z.object({
  id: z.string().optional(),
  tray_type: z.string().optional(),
  tray_color: z.string().optional(),
  remain: z.number().optional(),
}).passthrough();

export const BambuAmsUnitSchema = z.object({
  id: z.string().optional(),
  humidity: z.string().optional(),
  temp: z.string().optional(),
  tray: z.array(BambuAmsTraySchema).optional(),
}).passthrough();

export const BambuAmsSchema = z.object({
  ams: z.array(BambuAmsUnitSchema).optional(),
  tray_now: z.string().optional(),
  tray_tar: z.string().optional(),
  tray_pre: z.string().optional(),
}).passthrough();

export const BambuHmsItemSchema = z.object({
  attr: z.number().optional(),
  code: z.number().optional(),
}).passthrough();

export const BambuPrintReportSchema = z.object({
  gcode_state: z.string().optional(),
  mc_percent: z.number().optional(),
  mc_remaining_time: z.number().optional(),
  mc_print_stage: z.string().optional(),
  layer_num: z.number().optional(),
  total_layer_num: z.number().optional(),
  nozzle_temper: z.number().optional(),
  nozzle_target_temper: z.number().optional(),
  nozzle_diameter: z.union([z.string(), z.number()]).optional(),
  nozzle_type: z.string().optional(),
  bed_temper: z.number().optional(),
  bed_target_temper: z.number().optional(),
  chamber_temper: z.number().optional(),
  subtask_name: z.string().optional(),
  gcode_file: z.string().optional(),
  hms: z.array(BambuHmsItemSchema).optional(),
  ams: BambuAmsSchema.optional(),
  wifi_signal: z.string().optional(),
  fan_gear: z.number().optional(),
  cooling_fan_speed: z.union([z.string(), z.number()]).optional(),
  big_fan1_speed: z.union([z.string(), z.number()]).optional(),
  big_fan2_speed: z.union([z.string(), z.number()]).optional(),
  heatbreak_fan_speed: z.union([z.string(), z.number()]).optional(),
  spd_lvl: z.number().optional(),
  spd_mag: z.number().optional(),
  print_error: z.number().optional(),
  hw_switch_state: z.number().optional(),
  home_flag: z.number().optional(),
  lifecycle: z.string().optional(),
  print_type: z.string().optional(),
  sdcard: z.boolean().optional(),
  gcode_state_change_reason: z.string().optional(),
  upgrade_state: z.record(z.unknown()).optional(),
  fan_gear: z.number().optional(),
}).passthrough();

export const BambuReportSchema = z.object({
  print: BambuPrintReportSchema.optional(),
  info: z.record(z.unknown()).optional(),
  system: z.record(z.unknown()).optional(),
  mc_print: z.record(z.unknown()).optional(),
}).passthrough();

export type BambuReport = z.infer<typeof BambuReportSchema>;
export type BambuPrintReport = z.infer<typeof BambuPrintReportSchema>;
export type BambuAms = z.infer<typeof BambuAmsSchema>;
export type BambuHmsItem = z.infer<typeof BambuHmsItemSchema>;
