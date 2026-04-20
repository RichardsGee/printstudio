import { z } from 'zod';

export const PrinterStatusSchema = z.enum([
  'IDLE',
  'PREPARE',
  'PRINTING',
  'PAUSED',
  'FINISH',
  'FAILED',
  'OFFLINE',
  'UNKNOWN',
]);
export type PrinterStatus = z.infer<typeof PrinterStatusSchema>;

export const AmsSlotSchema = z.object({
  slot: z.number().int().min(0).max(3),
  filamentType: z.string().nullable(),
  color: z.string().nullable(),          // hex RGBA: e.g. "FFFFFFFF"
  remainingPct: z.number().min(0).max(100).nullable(),
  active: z.boolean().default(false),
});
export type AmsSlot = z.infer<typeof AmsSlotSchema>;

export const SpeedModeSchema = z.enum(['silent', 'standard', 'sport', 'ludicrous']);
export type SpeedMode = z.infer<typeof SpeedModeSchema>;

export const HmsErrorSchema = z.object({
  code: z.string(),
  severity: z.enum(['info', 'warning', 'error', 'fatal']),
  message: z.string().optional(),
});
export type HmsError = z.infer<typeof HmsErrorSchema>;

export const PrinterStateSchema = z.object({
  printerId: z.string().uuid(),
  status: PrinterStatusSchema,
  progressPct: z.number().min(0).max(100).nullable(),
  currentLayer: z.number().int().nullable(),
  totalLayers: z.number().int().nullable(),
  nozzleTemp: z.number().nullable(),
  nozzleTargetTemp: z.number().nullable(),
  bedTemp: z.number().nullable(),
  bedTargetTemp: z.number().nullable(),
  chamberTemp: z.number().nullable(),
  remainingSec: z.number().int().nullable(),
  currentFile: z.string().nullable(),
  hmsErrors: z.array(HmsErrorSchema),
  amsSlots: z.array(AmsSlotSchema),
  activeSlotIndex: z.number().int().nullable(),          // index of the tray currently feeding
  speedMode: SpeedModeSchema.nullable(),                 // silent | standard | sport | ludicrous
  speedPercent: z.number().nullable(),                   // spd_mag (%)
  wifiSignalDbm: z.number().nullable(),                  // parsed from "wifi_signal"
  fanPartCoolingPct: z.number().nullable(),              // cooling_fan_speed normalized 0..100
  fanAuxPct: z.number().nullable(),                      // big_fan1_speed
  fanChamberPct: z.number().nullable(),                  // big_fan2_speed
  nozzleDiameter: z.string().nullable(),                 // "0.4"
  nozzleType: z.string().nullable(),                     // "stainless_steel", "hardened_steel"
  stage: z.string().nullable(),                          // mc_print_stage human-readable
  updatedAt: z.string().datetime(),
});
export type PrinterState = z.infer<typeof PrinterStateSchema>;

export const PrinterConfigSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  serial: z.string(),
  accessCode: z.string(),
  ipAddress: z.string().ip().optional(),
  model: z.literal('A1').default('A1'),
});
export type PrinterConfig = z.infer<typeof PrinterConfigSchema>;
