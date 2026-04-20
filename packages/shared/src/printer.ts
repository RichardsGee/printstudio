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

/**
 * Unidade AMS (chassi físico). Bambu reporta humidade como um
 * inteiro 1..5 onde 1 = muito seco, 5 = muito úmido. Vamos expor
 * também uma aproximação em % pra UX.
 */
export const AmsUnitSchema = z.object({
  id: z.number().int().nullable(),
  /** Código 1..5 retornado pela Bambu; null quando não houver leitura. */
  humidityLevel: z.number().int().min(1).max(5).nullable(),
  /** % aproximada (1→20%, 2→35%, 3→50%, 4→65%, 5→80%) para display. */
  humidityPct: z.number().nullable(),
  /** Temperatura interna do AMS em °C. */
  tempC: z.number().nullable(),
});
export type AmsUnit = z.infer<typeof AmsUnitSchema>;

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
  amsUnits: z.array(AmsUnitSchema),
  activeSlotIndex: z.number().int().nullable(),          // index of the tray currently feeding
  speedMode: SpeedModeSchema.nullable(),                 // silent | standard | sport | ludicrous
  speedPercent: z.number().nullable(),                   // spd_mag (%)
  wifiSignalDbm: z.number().nullable(),                  // parsed from "wifi_signal"
  fanPartCoolingPct: z.number().nullable(),              // cooling_fan_speed normalized 0..100
  fanAuxPct: z.number().nullable(),                      // big_fan1_speed
  fanChamberPct: z.number().nullable(),                  // big_fan2_speed
  fanHeatbreakPct: z.number().nullable(),                // heatbreak_fan_speed
  nozzleDiameter: z.string().nullable(),                 // "0.4"
  nozzleType: z.string().nullable(),                     // "stainless_steel", "hardened_steel"
  stage: z.string().nullable(),                          // mc_print_stage human-readable
  doorOpen: z.boolean().nullable(),                      // derivado de hw_switch_state (bit 0)
  isFromSdCard: z.boolean().nullable(),                  // sdcard
  lifecycle: z.string().nullable(),                      // booting / online / ready
  printType: z.string().nullable(),                      // local | cloud | sd
  printErrorCode: z.number().nullable(),                 // print_error code
  stateChangeReason: z.string().nullable(),              // motivo da última transição
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
