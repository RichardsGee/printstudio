'use client';

import type { PrinterState } from '@printstudio/shared';
import { cn } from '@/lib/utils';

interface Props {
  state?: PrinterState;
  className?: string;
}

type Level = 'ok' | 'warn' | 'crit' | 'off';

interface Reading {
  label: string;
  value: string;
  /** 0..1 — quanto preencher do gauge. */
  fill: number;
  level: Level;
}

/**
 * Painel de sensores estilo Mission Control — temperaturas, ventoinhas
 * e WiFi exibidos como mini-gauges com nível por cor (ok/warn/crit).
 *
 * Rendered no slot esquerdo do card kiosk, no lugar onde antes ficava
 * o rolo de filamento. Cada linha: label · valor · gauge segmentado.
 */
export function SensorPanel({ state, className }: Props) {
  const readings: Reading[] = [];

  // Temperatura do bico
  if (state?.nozzleTemp != null) {
    const t = state.nozzleTemp;
    const tgt = state.nozzleTargetTemp ?? 0;
    readings.push({
      label: 'NOZZLE',
      value: tgt > 0 ? `${Math.round(t)}/${Math.round(tgt)}°` : `${Math.round(t)}°`,
      fill: tgt > 0 ? Math.min(1, t / tgt) : Math.min(1, t / 280),
      level: tempLevel(t, tgt),
    });
  }
  // Mesa
  if (state?.bedTemp != null) {
    const t = state.bedTemp;
    const tgt = state.bedTargetTemp ?? 0;
    readings.push({
      label: 'BED',
      value: tgt > 0 ? `${Math.round(t)}/${Math.round(tgt)}°` : `${Math.round(t)}°`,
      fill: tgt > 0 ? Math.min(1, t / tgt) : Math.min(1, t / 100),
      level: tempLevel(t, tgt),
    });
  }
  // Câmara (só se tiver leitura)
  if (state?.chamberTemp != null && state.chamberTemp > 0) {
    const t = state.chamberTemp;
    readings.push({
      label: 'CHAMB',
      value: `${Math.round(t)}°`,
      fill: Math.min(1, t / 60),
      level: t > 55 ? 'crit' : t > 45 ? 'warn' : 'ok',
    });
  }
  // Ventoinha de peça
  if (state?.fanPartCoolingPct != null) {
    const f = state.fanPartCoolingPct;
    readings.push({
      label: 'FAN',
      value: `${Math.round(f)}%`,
      fill: f / 100,
      level: f === 0 ? 'off' : f > 95 ? 'warn' : 'ok',
    });
  }
  // WiFi
  if (state?.wifiSignalDbm != null) {
    const dbm = state.wifiSignalDbm;
    readings.push({
      label: 'LINK',
      value: `${dbm}dBm`,
      // -50 = excelente (1.0), -90 = ruim (0.0)
      fill: Math.max(0, Math.min(1, (dbm + 90) / 40)),
      level: dbm > -60 ? 'ok' : dbm > -75 ? 'warn' : 'crit',
    });
  }

  return (
    <div
      className={cn('flex flex-col gap-1.5 px-1', className)}
      data-mc-sensor-panel
    >
      <div
        data-mc-id
        className="text-[10px] uppercase text-[var(--mc-accent)] opacity-70"
      >
        ◢ TLM // SENSORS
      </div>
      {readings.length === 0 ? (
        <div className="text-[10px] text-muted-foreground opacity-60">
          [no link]
        </div>
      ) : (
        readings.map((r) => <SensorRow key={r.label} {...r} />)
      )}
    </div>
  );
}

function SensorRow({ label, value, fill, level }: Reading) {
  return (
    <div className="flex items-center gap-2 text-[10px] leading-tight">
      <span
        data-mc-label
        className="w-12 shrink-0 text-muted-foreground uppercase tracking-wider"
      >
        {label}
      </span>
      <SegmentedBar fill={fill} level={level} className="flex-1" />
      <span
        data-mc-num
        className={cn(
          'shrink-0 text-right tabular-nums w-[3.5rem]',
          LEVEL_TEXT[level],
        )}
      >
        {value}
      </span>
    </div>
  );
}

function SegmentedBar({
  fill,
  level,
  className,
}: {
  fill: number;
  level: Level;
  className?: string;
}) {
  const segs = 12;
  const lit = Math.round(fill * segs);
  return (
    <div
      className={cn(
        'flex h-2 gap-px border border-[var(--mc-accent-soft)] p-px bg-black/40',
        className,
      )}
    >
      {Array.from({ length: segs }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'flex-1',
            i < lit ? LEVEL_FILL[level] : 'bg-[var(--mc-accent)]/10',
          )}
          style={i < lit ? { boxShadow: 'inset 0 0 1px rgba(255,255,255,0.4)' } : undefined}
        />
      ))}
    </div>
  );
}

function tempLevel(current: number, target: number): Level {
  if (target === 0) return current > 50 ? 'warn' : 'off';
  const diff = Math.abs(current - target);
  if (diff < 3) return 'ok';
  if (diff < 15) return 'warn';
  return 'crit';
}

const LEVEL_FILL: Record<Level, string> = {
  ok: 'bg-[var(--mc-accent)] shadow-[0_0_3px_var(--mc-accent)]',
  warn: 'bg-[var(--mc-warning)] shadow-[0_0_3px_var(--mc-warning)]',
  crit: 'bg-[var(--mc-danger)] shadow-[0_0_3px_var(--mc-danger)]',
  off: 'bg-[var(--mc-fg-dim)]',
};

const LEVEL_TEXT: Record<Level, string> = {
  ok: 'text-[var(--mc-accent)]',
  warn: 'text-[var(--mc-warning)]',
  crit: 'text-[var(--mc-danger)]',
  off: 'text-muted-foreground',
};
