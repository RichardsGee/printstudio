'use client';

import Link from 'next/link';
import { useCallback, useState } from 'react';
import {
  Printer,
  Pause,
  CheckCircle2,
  AlertTriangle,
  CloudOff,
  Circle,
  Loader2,
  Clock,
  Layers,
} from 'lucide-react';
import type { PrinterState, PrinterStatus } from '@printstudio/shared';
import { FilamentSwatch } from '@/components/filament-swatch';
import { KioskPrintObject } from '@/components/kiosk/kiosk-print-object';
import { KioskPrintObject3D } from '@/components/kiosk/kiosk-print-object-3d';
import { cn, formatDuration, formatEtaClock } from '@/lib/utils';

interface Props {
  printerId: string;
  name: string;
  state?: PrinterState;
}

/**
 * Variante kiosk do PrinterCard — visual chamativo pensado pra
 * monitor de parede ou tablet. Hero divide-se entre a Bambu A1
 * (identidade visual) e o objeto sendo impresso (com efeito de
 * preenchimento vertical baseado nas camadas).
 */
export function KioskPrinterCard({ printerId, name, state }: Props) {
  const [meshFailed, setMeshFailed] = useState(false);
  const onMeshError = useCallback(() => setMeshFailed(true), []);

  const status = state?.status ?? 'UNKNOWN';
  const progress = state?.progressPct ?? 0;
  const activeSlot =
    state?.amsSlots.find((s) => s.active) ??
    (state?.activeSlotIndex != null
      ? state.amsSlots.find((s) => s.slot === state.activeSlotIndex)
      : null);

  const hmsCount = state?.hmsErrors?.length ?? 0;
  const printing = status === 'PRINTING' || status === 'PAUSED' || status === 'PREPARE';
  const hasError = status === 'FAILED' || hmsCount > 0;

  const tone = hasError
    ? 'danger'
    : status === 'PAUSED'
      ? 'warning'
      : printing
        ? 'info'
        : status === 'FINISH'
          ? 'success'
          : 'muted';

  return (
    <Link
      href={`/printers/${printerId}`}
      className={cn(
        'relative block rounded-2xl border-2 overflow-hidden transition-colors',
        'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring',
        TONE_CLASSES[tone],
      )}
    >
      {/* Status header */}
      <div className={cn('px-4 py-2 flex items-center gap-2', TONE_HEADER_CLASSES[tone])}>
        <StatusIcon status={status} />
        <span
          className="font-semibold uppercase tracking-wider"
          style={{ fontSize: 'clamp(0.75rem, 1.2vw, 1rem)' }}
        >
          {STATUS_LABELS[status]}
        </span>
        <span
          className="ml-auto font-semibold tracking-tight truncate text-foreground"
          style={{ fontSize: 'clamp(0.875rem, 1.4vw, 1.125rem)' }}
        >
          {name}
        </span>
        {hmsCount > 0 ? (
          <span
            className="rounded-full bg-danger px-2 py-0.5 font-bold text-danger-foreground"
            style={{ fontSize: 'clamp(0.6875rem, 1vw, 0.875rem)' }}
          >
            {hmsCount} erro{hmsCount > 1 ? 's' : ''}
          </span>
        ) : null}
      </div>

      {/* HERO — duas variações:
            - imprimindo: split com Bambu A1 + objeto com fill vertical;
            - ociosa/concluída/erro: Bambu A1 grande, sem distração */}
      {printing ? (
        <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-2 p-3 bg-gradient-to-b from-muted/30 to-background">
          <div className="relative aspect-square rounded-xl border border-border/60 bg-gradient-to-br from-muted/30 to-background overflow-hidden flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/bambu-a1.png"
              alt="Bambu Lab A1"
              className="max-h-full max-w-full object-contain p-2"
              draggable={false}
            />
            <div
              className="absolute top-1.5 left-2 font-mono uppercase tracking-wider text-muted-foreground"
              style={{ fontSize: 'clamp(0.5625rem, 0.85vw, 0.75rem)' }}
            >
              A1 + AMS
            </div>
          </div>
          {meshFailed ? (
            <KioskPrintObject
              printerId={printerId}
              cacheKey={state?.currentFile ?? null}
              currentLayer={state?.currentLayer ?? null}
              totalLayers={state?.totalLayers ?? null}
              filamentColor={activeSlot?.color ?? null}
              className="aspect-square"
            />
          ) : (
            <KioskPrintObject3D
              printerId={printerId}
              cacheKey={state?.currentFile ?? null}
              currentLayer={state?.currentLayer ?? null}
              totalLayers={state?.totalLayers ?? null}
              filamentColor={activeSlot?.color ?? null}
              onError={onMeshError}
              className="aspect-square"
            />
          )}
        </div>
      ) : (
        <div className="relative aspect-[16/9] bg-gradient-to-b from-muted/30 to-background overflow-hidden flex items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/bambu-a1.png"
            alt="Bambu Lab A1"
            className="max-h-full max-w-full object-contain p-4"
            draggable={false}
          />
        </div>
      )}

      <div className="p-5 space-y-4">
        {/* Filamento + swatch grande */}
        {activeSlot ? (
          <div className="flex items-center gap-3">
            <FilamentSwatch
              color={activeSlot.color ?? null}
              active={!!activeSlot}
              size="lg"
            />
            <div className="min-w-0">
              <div
                className="font-medium truncate"
                style={{ fontSize: 'clamp(0.875rem, 1.4vw, 1.125rem)' }}
              >
                {activeSlot.filamentType ?? 'Filamento'}
              </div>
              <div
                className="text-muted-foreground"
                style={{ fontSize: 'clamp(0.6875rem, 1vw, 0.875rem)' }}
              >
                Slot {activeSlot.slot + 1}
              </div>
            </div>
          </div>
        ) : null}

        {/* Progresso GIANT quando imprimindo */}
        {printing ? (
          <>
            <div className="flex items-baseline gap-3">
              <span
                className="font-semibold tabular-nums leading-none text-foreground"
                style={{ fontSize: 'clamp(3rem, 8vw, 6rem)' }}
              >
                {progress.toFixed(0)}
              </span>
              <span
                className="text-muted-foreground"
                style={{ fontSize: 'clamp(1.5rem, 3vw, 2.5rem)' }}
              >
                %
              </span>
            </div>

            <div className="h-3 w-full rounded-full bg-muted/60 overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all duration-500', TONE_BAR_CLASSES[tone])}
                style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
              />
            </div>

            {state?.stage && state.stage !== 'Imprimindo' ? (
              <div
                className="text-muted-foreground truncate"
                style={{ fontSize: 'clamp(0.875rem, 1.4vw, 1.125rem)' }}
              >
                {state.stage}
              </div>
            ) : null}
          </>
        ) : (
          <div
            className="text-muted-foreground"
            style={{ fontSize: 'clamp(1rem, 1.6vw, 1.25rem)' }}
          >
            {hasError
              ? state?.hmsErrors?.[0]?.message ?? 'Erro na impressora'
              : status === 'FINISH'
                ? `Concluído · ${state?.currentFile ?? '—'}`
                : status === 'OFFLINE'
                  ? 'Sem comunicação com a impressora'
                  : 'Pronta para imprimir'}
          </div>
        )}

        {/* Footer com ETA + camadas — só faz sentido se imprimindo */}
        {printing ? (
          <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border/40">
            <KioskMetric
              icon={Clock}
              label="Termina às"
              value={formatEtaClock(state?.remainingSec)}
              subtitle={formatDuration(state?.remainingSec)}
            />
            <KioskMetric
              icon={Layers}
              label="Camada"
              value={
                state?.currentLayer != null && state?.totalLayers != null
                  ? `${state.currentLayer}/${state.totalLayers}`
                  : '—'
              }
            />
          </div>
        ) : null}

        {/* Arquivo atual quando imprimindo (truncado) */}
        {printing && state?.currentFile ? (
          <div
            className="text-muted-foreground truncate"
            style={{ fontSize: 'clamp(0.75rem, 1.1vw, 0.9375rem)' }}
            title={state.currentFile}
          >
            {state.currentFile}
          </div>
        ) : null}
      </div>
    </Link>
  );
}

function KioskMetric({
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
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Icon className="h-4 w-4 shrink-0" />
        <span
          className="uppercase tracking-wider"
          style={{ fontSize: 'clamp(0.625rem, 0.9vw, 0.75rem)' }}
        >
          {label}
        </span>
      </div>
      <div className="flex items-baseline gap-2">
        <span
          className="font-semibold tabular-nums"
          style={{ fontSize: 'clamp(1.25rem, 2.4vw, 2rem)' }}
        >
          {value}
        </span>
        {subtitle ? (
          <span
            className="text-muted-foreground tabular-nums"
            style={{ fontSize: 'clamp(0.75rem, 1.1vw, 0.9375rem)' }}
          >
            {subtitle}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function StatusIcon({ status }: { status: PrinterStatus }) {
  const Icon = STATUS_ICONS[status];
  const spin = status === 'PREPARE';
  return <Icon className={cn('h-5 w-5 shrink-0', spin && 'animate-spin')} />;
}

const STATUS_LABELS: Record<PrinterStatus, string> = {
  IDLE: 'Ociosa',
  PREPARE: 'Preparando',
  PRINTING: 'Imprimindo',
  PAUSED: 'Pausada',
  FINISH: 'Concluída',
  FAILED: 'Falha',
  OFFLINE: 'Offline',
  UNKNOWN: 'Desconhecido',
};

const STATUS_ICONS: Record<PrinterStatus, React.ElementType> = {
  IDLE: Circle,
  PREPARE: Loader2,
  PRINTING: Printer,
  PAUSED: Pause,
  FINISH: CheckCircle2,
  FAILED: AlertTriangle,
  OFFLINE: CloudOff,
  UNKNOWN: Circle,
};

type Tone = 'danger' | 'warning' | 'info' | 'success' | 'muted';

const TONE_CLASSES: Record<Tone, string> = {
  danger: 'border-danger/60 bg-card',
  warning: 'border-warning/50 bg-card',
  info: 'border-primary/40 bg-card',
  success: 'border-success/40 bg-card',
  muted: 'border-border/60 bg-card',
};

const TONE_HEADER_CLASSES: Record<Tone, string> = {
  danger: 'bg-danger/15 text-danger border-b border-danger/30',
  warning: 'bg-warning/15 text-warning border-b border-warning/30',
  info: 'bg-primary/10 text-primary border-b border-primary/20',
  success: 'bg-success/15 text-success border-b border-success/30',
  muted: 'bg-muted/40 text-muted-foreground border-b border-border/40',
};

const TONE_BAR_CLASSES: Record<Tone, string> = {
  danger: 'bg-gradient-to-r from-danger/80 to-danger',
  warning: 'bg-gradient-to-r from-warning/80 to-warning',
  info: 'bg-gradient-to-r from-primary/80 to-primary',
  success: 'bg-gradient-to-r from-success/80 to-success',
  muted: 'bg-muted',
};
