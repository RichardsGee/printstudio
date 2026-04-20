import type { AmsSlot, AmsUnit } from '@printstudio/shared';
import { Droplets, Thermometer } from 'lucide-react';
import { Spool } from './spool';
import { cn } from '@/lib/utils';

/**
 * Compact AMS view — 4 slots rendered as spool + stats side-by-side, all
 * in a single row so they fill whatever width the parent gives us.
 */
export function AmsDisplay({
  slots,
  units = [],
  /** Modelo da impressora — AMS Lite (A1) não tem sensor físico de humidade/temp,
   *  então a Bambu reporta valores placeholder (geralmente level 5, tempC 0).
   *  Esconder a barra nesse caso evita informação enganosa. */
  model,
  bare = false,
}: {
  slots: AmsSlot[];
  units?: AmsUnit[];
  model?: string | null;
  bare?: boolean;
}) {
  const normalized: (AmsSlot | null)[] = [0, 1, 2, 3].map(
    (i) => slots.find((s) => s.slot === i) ?? null,
  );

  const unit = units[0] ?? null;
  const isAmsLite = (model ?? '').toUpperCase().startsWith('A1');
  const showUnitBar =
    unit && !isAmsLite && (unit.humidityLevel !== null || (unit.tempC !== null && unit.tempC > 0));

  const body = (
    <div className="space-y-2">
      {showUnitBar ? <AmsUnitBar unit={unit} /> : null}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {normalized.map((slot, i) => (
          <SlotCell key={i} slot={slot} index={i} />
        ))}
      </div>
    </div>
  );

  if (bare) return body;
  return <div className="rounded-xl border border-border/60 bg-card p-3">{body}</div>;
}

function AmsUnitBar({ unit }: { unit: AmsUnit }) {
  const level = unit.humidityLevel;
  const humidityLabel =
    level === null
      ? '—'
      : level <= 2
        ? 'Seco'
        : level === 3
          ? 'OK'
          : level === 4
            ? 'Úmido'
            : 'Muito úmido';
  const humidityTone =
    level === null
      ? 'text-muted-foreground'
      : level <= 2
        ? 'text-emerald-400'
        : level === 3
          ? 'text-amber-400'
          : 'text-red-400';

  return (
    <div className="flex items-center justify-between gap-3 px-2 py-1 rounded-md bg-muted/30 text-[11px]">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <Droplets className={cn('h-3.5 w-3.5', humidityTone)} />
          <span className="text-muted-foreground">Humidade</span>
          <span className={cn('font-medium', humidityTone)}>
            {humidityLabel}
            {unit.humidityPct !== null ? ` (~${unit.humidityPct}%)` : ''}
          </span>
        </div>
        {unit.tempC !== null ? (
          <div className="flex items-center gap-1.5">
            <Thermometer className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">Temp AMS</span>
            <span className="font-medium tabular-nums">{unit.tempC.toFixed(1)}°C</span>
          </div>
        ) : null}
      </div>
      {level !== null && level >= 4 ? (
        <span className="text-[10px] font-mono uppercase text-red-400">
          ⚠ Secar filamento
        </span>
      ) : null}
    </div>
  );
}

function SlotCell({ slot, index }: { slot: AmsSlot | null; index: number }) {
  const active = !!slot?.active;
  const pct = slot?.remainingPct ?? null;
  const color = normalizeHex(slot?.color);

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-lg border px-2 py-1.5',
        active ? 'border-primary/50 bg-primary/[0.03]' : 'border-border/40',
      )}
    >
      <Spool
        color={slot?.color ?? null}
        active={active}
        rotating={active}
        size={84}
      />
      <div className="min-w-0 flex-1 flex flex-col gap-0.5">
        <div className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground">
          <span>SLOT {index + 1}</span>
          {active ? <span className="text-primary">• ativo</span> : null}
        </div>
        <div className="flex items-center gap-1.5">
          <div
            className={cn(
              'h-3 w-3 rounded-full shrink-0 ring-1 ring-border',
              !color && 'bg-muted/40',
            )}
            style={color ? { backgroundColor: color } : undefined}
          />
          <span className="text-xs truncate">
            {slot?.filamentType ?? '—'}
          </span>
        </div>
        {pct !== null ? (
          <div className="flex items-center gap-1.5">
            <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
              <div
                className={cn('h-full', active ? 'bg-primary' : 'bg-foreground/60')}
                style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
              />
            </div>
            <span className="text-[10px] font-mono tabular-nums text-muted-foreground">
              {Math.round(pct)}%
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function normalizeHex(color: string | null | undefined): string | null {
  if (!color) return null;
  const m = color.match(/^#?([0-9a-fA-F]{6,8})$/);
  if (!m) return null;
  return `#${m[1]}`;
}
