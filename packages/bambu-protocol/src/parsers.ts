/**
 * Parsers converting Bambu-native payloads into PrintStudio domain types.
 *
 * Reference: https://github.com/Doridian/OpenBambuAPI/blob/main/mqtt.md
 */

import type { PrinterState, PrinterStatus, AmsSlot, HmsError, SpeedMode } from '@printstudio/shared';
import type { BambuReport, BambuHmsItem, BambuAms } from './types.js';

const GCODE_STATE_MAP: Record<string, PrinterStatus> = {
  IDLE: 'IDLE',
  PREPARE: 'PREPARE',
  RUNNING: 'PRINTING',
  PAUSE: 'PAUSED',
  FINISH: 'FINISH',
  FAILED: 'FAILED',
  UNKNOWN: 'UNKNOWN',
};

export function mapGcodeState(state?: string): PrinterStatus {
  if (!state) return 'UNKNOWN';
  return GCODE_STATE_MAP[state.toUpperCase()] ?? 'UNKNOWN';
}

/**
 * HMS codes are two 32-bit ints (attr + code). Severity is encoded in the top
 * bits of `attr`. See OpenBambuAPI mqtt.md for the encoding details.
 */
export function parseHmsError(item: BambuHmsItem): HmsError | null {
  if (item.code === undefined || item.attr === undefined) return null;
  const severityBits = (item.attr >> 16) & 0xf;
  const severity: HmsError['severity'] =
    severityBits >= 0xc ? 'fatal' : severityBits >= 0x8 ? 'error' : severityBits >= 0x4 ? 'warning' : 'info';
  const code = `HMS_${item.attr.toString(16).toUpperCase()}_${item.code.toString(16).toUpperCase()}`;
  return { code, severity };
}

export function parseAmsSlots(ams?: BambuAms): AmsSlot[] {
  if (!ams?.ams || ams.ams.length === 0) return [];
  const activeSlot = parseActiveSlot(ams);
  const slots: AmsSlot[] = [];
  for (const unit of ams.ams) {
    if (!unit.tray) continue;
    for (const tray of unit.tray) {
      const slotNum = Number(tray.id ?? 0);
      slots.push({
        slot: Number.isFinite(slotNum) ? slotNum : 0,
        filamentType: tray.tray_type ?? null,
        color: tray.tray_color ?? null,
        remainingPct: typeof tray.remain === 'number' ? tray.remain : null,
        active: Number.isFinite(slotNum) && slotNum === activeSlot,
      });
    }
  }
  return slots;
}

export function parseActiveSlot(ams?: BambuAms): number | null {
  if (!ams) return null;
  // `tray_tar` is the tray the printer is actively feeding from during a
  // print. `tray_now` is what's physically loaded — can stay set from a
  // previous print. Prefer target when present.
  // 254 = extruder empty, 255 = waiting to load a tray → not active.
  const raw = ams.tray_tar ?? ams.tray_now;
  if (raw === undefined || raw === null || raw === '') return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n >= 254) return null;
  return n;
}

const SPEED_MODE_MAP: Record<number, SpeedMode> = {
  1: 'silent',
  2: 'standard',
  3: 'sport',
  4: 'ludicrous',
};

export function mapSpeedMode(lvl?: number): SpeedMode | null {
  if (lvl === undefined) return null;
  return SPEED_MODE_MAP[lvl] ?? null;
}

/** Parses "-27dBm" → -27, "-32" → -32. */
export function parseWifiDbm(v?: string): number | null {
  if (!v) return null;
  const m = v.match(/-?\d+/);
  return m ? Number(m[0]) : null;
}

/** Bambu sends fan speeds as 0-15 (gear) on some fields, and 0-100 % on others. Normalize. */
export function parseFanPct(v: string | number | undefined): number | null {
  if (v === undefined || v === null) return null;
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return null;
  // If <= 15 assume gear 0..15, otherwise treat as percent already.
  return n <= 15 ? Math.round((n / 15) * 100) : Math.min(100, Math.round(n));
}

/**
 * Mapa dos estágios `mc_print_stage` publicados pela A1.
 * Códigos vindos da documentação e engenharia reversa da Bambu —
 * cobrem desde preparações iniciais até pausas e finalização.
 */
const STAGE_MAP: Record<string, string> = {
  '-1': 'Ocioso',
  '0': 'Preparando',
  '1': 'Imprimindo',
  '2': 'Nivelando mesa',
  '3': 'Pré-aquecendo mesa',
  '4': 'Limpando bico',
  '5': 'Verificando fluxo',
  '6': 'Calibrando Z',
  '7': 'Carregando filamento',
  '8': 'Descarregando filamento',
  '9': 'Trocando filamento',
  '10': 'Pausa M400',
  '11': 'Pausa por acabou filamento',
  '12': 'Aquecendo bico',
  '13': 'Calibrando extrusão',
  '14': 'Pausado',
  '15': 'Scanning da mesa',
  '16': 'Inspecionando primeira camada',
  '17': 'Identificando placa',
  '18': 'Calibrando Micro Lidar',
  '19': 'Homing',
  '20': 'Limpando ponta do bico',
  '21': 'Verificando temperatura do bico',
  '22': 'Pausado pelo usuário',
  '23': 'Pausa por tampa aberta',
  '24': 'Calibrando Micro Lidar',
  '25': 'Calibrando fluxo de extrusão',
  '26': 'Pausa por temperatura do bico',
  '27': 'Pausa por temperatura da mesa',
  '28': 'Cortando filamento',
  '29': 'Pausa (skip step)',
  '30': 'Carregando filamento',
  '31': 'Calibrando ruído do motor',
  '32': 'Pausa por AMS desconectado',
  '33': 'Pausa por ventoinha lenta',
  '34': 'Pausa por temperatura da câmara',
  '35': 'Resfriando câmara',
  '36': 'Pausa via G-code',
  '37': 'Demo de ruído do motor',
  '38': 'Calibrando temperatura do hotend',
  '39': 'Guardando arquivo',
  '40': 'Encerrando impressão',
  '41': 'Finalizando',
  '42': 'Terminado',
  '255': 'Ocioso',
};

export function mapStage(stage?: string): string | null {
  if (!stage) return null;
  return STAGE_MAP[stage] ?? null;
}

/**
 * Merge a new Bambu report into an existing PrinterState.
 * Bambu sends partial updates — fields not present should keep prior values.
 */
export function applyReport(
  previous: PrinterState,
  report: BambuReport,
): PrinterState {
  const print = report.print;
  if (!print) {
    return { ...previous, updatedAt: new Date().toISOString() };
  }
  const nozzleDiameter =
    print.nozzle_diameter !== undefined ? String(print.nozzle_diameter) : previous.nozzleDiameter;
  const status = print.gcode_state !== undefined ? mapGcodeState(print.gcode_state) : previous.status;
  const rawStage = print.mc_print_stage !== undefined ? mapStage(print.mc_print_stage) : previous.stage;
  // Em status terminais (FINISH/IDLE/FAILED), suprime o stage antigo
  // — evita mostrar "Concluído" + "Imprimindo" simultaneamente quando
  // a Bambu demora um ciclo pra atualizar `mc_print_stage`.
  const stage =
    status === 'FINISH' || status === 'IDLE' || status === 'FAILED' || status === 'OFFLINE'
      ? null
      : rawStage;
  return {
    ...previous,
    status,
    progressPct: print.mc_percent ?? previous.progressPct,
    remainingSec:
      typeof print.mc_remaining_time === 'number'
        ? Math.round(print.mc_remaining_time * 60)
        : previous.remainingSec,
    currentLayer: print.layer_num ?? previous.currentLayer,
    totalLayers: print.total_layer_num ?? previous.totalLayers,
    nozzleTemp: print.nozzle_temper ?? previous.nozzleTemp,
    nozzleTargetTemp: print.nozzle_target_temper ?? previous.nozzleTargetTemp,
    bedTemp: print.bed_temper ?? previous.bedTemp,
    bedTargetTemp: print.bed_target_temper ?? previous.bedTargetTemp,
    chamberTemp: print.chamber_temper ?? previous.chamberTemp,
    currentFile: print.subtask_name ?? print.gcode_file ?? previous.currentFile,
    hmsErrors: print.hms
      ? print.hms.map(parseHmsError).filter((e): e is HmsError => e !== null)
      : previous.hmsErrors,
    // Bambu often sends partial AMS updates (just `tray_now` without the full
    // `ams.ams[]` array). Only replace the cached slots when the report
    // actually carries a non-empty tray list — otherwise keep what we have.
    amsSlots:
      print.ams?.ams && print.ams.ams.length > 0 ? parseAmsSlots(print.ams) : previous.amsSlots,
    activeSlotIndex:
      print.ams?.tray_now !== undefined || print.ams?.tray_tar !== undefined
        ? parseActiveSlot(print.ams) ?? previous.activeSlotIndex
        : previous.activeSlotIndex,
    speedMode: print.spd_lvl !== undefined ? mapSpeedMode(print.spd_lvl) : previous.speedMode,
    speedPercent: print.spd_mag ?? previous.speedPercent,
    wifiSignalDbm: print.wifi_signal !== undefined ? parseWifiDbm(print.wifi_signal) : previous.wifiSignalDbm,
    fanPartCoolingPct:
      print.cooling_fan_speed !== undefined ? parseFanPct(print.cooling_fan_speed) : previous.fanPartCoolingPct,
    fanAuxPct: print.big_fan1_speed !== undefined ? parseFanPct(print.big_fan1_speed) : previous.fanAuxPct,
    fanChamberPct:
      print.big_fan2_speed !== undefined ? parseFanPct(print.big_fan2_speed) : previous.fanChamberPct,
    nozzleDiameter,
    nozzleType: print.nozzle_type ?? previous.nozzleType,
    stage,
    updatedAt: new Date().toISOString(),
  };
}

export function emptyState(printerId: string): PrinterState {
  return {
    printerId,
    status: 'UNKNOWN',
    progressPct: null,
    currentLayer: null,
    totalLayers: null,
    nozzleTemp: null,
    nozzleTargetTemp: null,
    bedTemp: null,
    bedTargetTemp: null,
    chamberTemp: null,
    remainingSec: null,
    currentFile: null,
    hmsErrors: [],
    amsSlots: [],
    activeSlotIndex: null,
    speedMode: null,
    speedPercent: null,
    wifiSignalDbm: null,
    fanPartCoolingPct: null,
    fanAuxPct: null,
    fanChamberPct: null,
    nozzleDiameter: null,
    nozzleType: null,
    stage: null,
    updatedAt: new Date().toISOString(),
  };
}

export function parseReportJson(raw: string | Buffer): BambuReport | null {
  try {
    const text = typeof raw === 'string' ? raw : raw.toString('utf-8');
    return JSON.parse(text) as BambuReport;
  } catch {
    return null;
  }
}
