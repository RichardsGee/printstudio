'use client';

import Link from 'next/link';
import { ArrowUpRight, Clock, Layers, Thermometer, Flame } from 'lucide-react';
import type { PrinterState } from '@printstudio/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/status-badge';
import { FilamentSwatch } from '@/components/filament-swatch';
import { SpeedModeIndicator } from '@/components/speed-mode-indicator';
import { WifiIndicator } from '@/components/wifi-indicator';
import { ThumbnailPreview } from '@/components/thumbnail-preview';
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

  return (
    <Card className="relative overflow-hidden">
      <Link
        href={`/printers/${printerId}`}
        className="absolute right-3 top-3 text-muted-foreground hover:text-foreground transition-colors"
        aria-label={`Detalhe ${name}`}
      >
        <ArrowUpRight className="h-4 w-4" />
      </Link>

      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between pr-8 text-base">
          <span className="truncate">{name}</span>
          <StatusBadge status={status} />
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid grid-cols-[5rem_1fr] gap-3 items-start">
          <ThumbnailPreview
            printerId={printerId}
            cacheKey={state?.currentFile ?? null}
          />
          <div className="min-w-0 space-y-1">
            <div className="text-sm font-medium truncate">
              {state?.currentFile ?? 'Sem impressão'}
            </div>
            <div className="flex items-center gap-1.5">
              <FilamentSwatch color={activeSlot?.color ?? null} active={!!activeSlot} size="sm" />
              <span className="text-xs text-muted-foreground truncate">
                {state?.stage ?? (activeSlot?.filamentType ?? 'aguardando')}
              </span>
            </div>
            <div className="flex items-baseline gap-1 pt-1">
              <span className="text-2xl font-semibold tabular-nums">
                {progress.toFixed(0)}
              </span>
              <span className="text-sm text-muted-foreground">%</span>
            </div>
          </div>
        </div>

        <div>
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
            />
          </div>
        </div>

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
