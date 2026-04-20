'use client';

import Link from 'next/link';
import { ArrowUpRight, Clock, Layers, Thermometer, Flame } from 'lucide-react';
import type { PrinterState } from '@printstudio/shared';
import { Card, CardContent } from '@/components/ui/card';
import { StatusBadge } from '@/components/status-badge';
import { FilamentSwatch } from '@/components/filament-swatch';
import { SpeedModeIndicator } from '@/components/speed-mode-indicator';
import { WifiIndicator } from '@/components/wifi-indicator';
import { formatDuration, formatEtaClock } from '@/lib/utils';

interface Props {
  printerId: string;
  name: string;
  state?: PrinterState;
}

export function PrinterCard({ printerId, name, state }: Props) {
  const status = state?.status ?? 'UNKNOWN';
  const progress = state?.progressPct ?? 0;
  const activeSlot =
    state?.amsSlots.find((s) => s.active) ??
    (state?.activeSlotIndex != null
      ? state.amsSlots.find((s) => s.slot === state.activeSlotIndex)
      : null);

  const printing = status === 'PRINTING' || status === 'PAUSED' || status === 'PREPARE';

  return (
    <Card className="relative overflow-hidden group">
      <Link
        href={`/printers/${printerId}`}
        className="absolute inset-0 z-10"
        aria-label={`Detalhe ${name}`}
      />

      {/* Hero — imagem da Bambu A1 com o estado em overlay */}
      <div className="relative aspect-[4/3] w-full bg-gradient-to-b from-muted/40 to-background overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/bambu-a1.png"
          alt="Bambu Lab A1"
          className="absolute inset-0 h-full w-full object-contain object-center p-4 transition-transform duration-500 group-hover:scale-105"
          draggable={false}
        />

        {/* Status + nome no topo */}
        <div className="absolute inset-x-0 top-0 p-3 flex items-start justify-between">
          <div className="min-w-0">
            <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              Bambu Lab A1
            </div>
            <div className="text-sm font-semibold truncate">{name}</div>
          </div>
          <div className="flex items-center gap-1.5">
            <StatusBadge status={status} />
            <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
          </div>
        </div>

        {/* Progresso grande quando imprimindo */}
        {printing ? (
          <div className="absolute bottom-3 left-3 right-3">
            <div className="flex items-baseline gap-1.5 mb-1.5">
              <span className="text-3xl font-semibold tabular-nums leading-none">
                {progress.toFixed(0)}
              </span>
              <span className="text-sm text-muted-foreground">%</span>
              <span className="ml-auto text-[11px] text-muted-foreground truncate max-w-[55%]">
                {state?.currentFile ?? '—'}
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-background/60 backdrop-blur-sm overflow-hidden border border-border/40">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
              />
            </div>
          </div>
        ) : (
          <div className="absolute bottom-3 left-3 right-3 flex items-center gap-1.5">
            <FilamentSwatch color={activeSlot?.color ?? null} active={!!activeSlot} size="sm" />
            <span className="text-xs text-muted-foreground truncate">
              {state?.stage ?? (activeSlot?.filamentType ?? 'ociosa')}
            </span>
          </div>
        )}
      </div>

      {/* Stats */}
      <CardContent className="space-y-3 pt-4">
        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
          <InfoRow
            icon={Clock}
            label="Conclui"
            value={formatEtaClock(state?.remainingSec)}
            subtitle={formatDuration(state?.remainingSec)}
          />
          <InfoRow
            icon={Layers}
            label="Camada"
            value={`${state?.currentLayer ?? '—'}/${state?.totalLayers ?? '—'}`}
          />
          <InfoRow
            icon={Thermometer}
            label="Bico"
            value={formatTemp(state?.nozzleTemp, state?.nozzleTargetTemp)}
          />
          <InfoRow
            icon={Flame}
            label="Mesa"
            value={formatTemp(state?.bedTemp, state?.bedTargetTemp)}
          />
        </div>

        <div className="flex items-center justify-between border-t border-border/60 pt-3">
          <SpeedModeIndicator mode={state?.speedMode ?? null} percent={state?.speedPercent} />
          <WifiIndicator dbm={state?.wifiSignalDbm ?? null} showDbm={false} />
        </div>
      </CardContent>
    </Card>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
  subtitle,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  subtitle?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <span className="text-muted-foreground">{label}</span>
      <span className="ml-auto font-medium tabular-nums truncate">{value}</span>
      {subtitle ? (
        <span className="text-[10px] text-muted-foreground tabular-nums">{subtitle}</span>
      ) : null}
    </div>
  );
}

function formatTemp(current: number | null | undefined, target: number | null | undefined): string {
  if (current == null) return '—';
  const c = Math.round(current);
  if (target == null || target === 0) return `${c}°`;
  return `${c}° / ${Math.round(target)}°`;
}
