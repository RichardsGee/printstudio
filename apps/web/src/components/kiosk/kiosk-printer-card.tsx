'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
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
import { RealisticPreview3D } from '@/components/realistic-preview-3d';
import { cn, formatDuration, formatEtaClock } from '@/lib/utils';

const LAN_HOST = process.env.NEXT_PUBLIC_LAN_DISCOVERY_HOST ?? 'localhost';
const LAN_PORT = process.env.NEXT_PUBLIC_LAN_DISCOVERY_PORT ?? '8080';

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
  // Detecta se há .3mf vinculado pra escolher render: 3D realista
  // (modelo com mesh) vs PNG com fill vertical (fallback).
  const [hasUploadedModel, setHasUploadedModel] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    fetch(`http://${LAN_HOST}:${LAN_PORT}/api/printers/${printerId}/uploaded-model.info`)
      .then((r) => { if (alive) setHasUploadedModel(r.ok); })
      .catch(() => { if (alive) setHasUploadedModel(false); });
    return () => { alive = false; };
  }, [printerId]);

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

      {/* HERO unificado: SEMPRE grid 2:3 (Bambu | Objeto) — mesma
          estrutura visual em qualquer estado pra consistência no
          dashboard. Quando ociosa, slot do objeto fica como
          placeholder estilizado. */}
      <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-2 p-2.5 bg-gradient-to-b from-muted/30 to-background">
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

        {printing ? (
          hasUploadedModel ? (
            <RealisticPreview3D
              printerId={printerId}
              currentLayer={state?.currentLayer ?? null}
              totalLayers={state?.totalLayers ?? null}
              filamentColor={activeSlot?.color ?? null}
              className="aspect-square"
            />
          ) : (
            <KioskPrintObject
              printerId={printerId}
              cacheKey={state?.currentFile ?? null}
              currentLayer={state?.currentLayer ?? null}
              totalLayers={state?.totalLayers ?? null}
              filamentColor={activeSlot?.color ?? null}
              className="aspect-square"
            />
          )
        ) : (
          <IdleObjectPlaceholder status={status} />
        )}
      </div>

      <div className="p-3 space-y-2.5">
        {/* Linha 1: filamento + progresso inline (só quando imprimindo) */}
        <div className="flex items-center justify-between gap-3">
          {activeSlot ? (
            <div className="flex items-center gap-2 min-w-0">
              <FilamentSwatch
                color={activeSlot.color ?? null}
                active={!!activeSlot}
                size="md"
              />
              <div className="min-w-0">
                <div
                  className="font-medium truncate leading-tight"
                  style={{ fontSize: 'clamp(0.8125rem, 1.2vw, 1rem)' }}
                >
                  {activeSlot.filamentType ?? 'Filamento'}
                </div>
                <div
                  className="text-muted-foreground leading-tight"
                  style={{ fontSize: 'clamp(0.625rem, 0.9vw, 0.8125rem)' }}
                >
                  Slot {activeSlot.slot + 1}
                </div>
              </div>
            </div>
          ) : (
            <div
              className="text-muted-foreground truncate"
              style={{ fontSize: 'clamp(0.8125rem, 1.2vw, 1rem)' }}
            >
              {hasError
                ? state?.hmsErrors?.[0]?.message ?? 'Erro na impressora'
                : status === 'FINISH'
                  ? 'Concluído'
                  : status === 'OFFLINE'
                    ? 'Sem comunicação'
                    : 'Pronta para imprimir'}
            </div>
          )}

          {printing ? (
            <div className="flex items-baseline gap-1 shrink-0">
              <span
                className="font-semibold tabular-nums leading-none text-foreground"
                style={{ fontSize: 'clamp(1.75rem, 3.6vw, 2.75rem)' }}
              >
                {progress.toFixed(0)}
              </span>
              <span
                className="text-muted-foreground"
                style={{ fontSize: 'clamp(0.875rem, 1.5vw, 1.25rem)' }}
              >
                %
              </span>
            </div>
          ) : null}
        </div>

        {/* Progress bar */}
        {printing ? (
          <div className="h-2 w-full rounded-full bg-muted/60 overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all duration-500', TONE_BAR_CLASSES[tone])}
              style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
            />
          </div>
        ) : null}

        {/* Linha 2 (printing): ETA · Camada · Arquivo */}
        {printing ? (
          <div className="flex items-center justify-between gap-3 text-muted-foreground">
            <span
              className="inline-flex items-center gap-1.5 shrink-0"
              style={{ fontSize: 'clamp(0.6875rem, 1vw, 0.875rem)' }}
            >
              <Clock className="h-3.5 w-3.5" />
              <span className="font-semibold text-foreground tabular-nums">
                {formatEtaClock(state?.remainingSec)}
              </span>
              <span className="opacity-70 tabular-nums">
                {formatDuration(state?.remainingSec)}
              </span>
            </span>
            <span
              className="inline-flex items-center gap-1.5 shrink-0"
              style={{ fontSize: 'clamp(0.6875rem, 1vw, 0.875rem)' }}
            >
              <Layers className="h-3.5 w-3.5" />
              <span className="font-semibold text-foreground tabular-nums">
                {state?.currentLayer != null && state?.totalLayers != null
                  ? `${state.currentLayer}/${state.totalLayers}`
                  : '—'}
              </span>
            </span>
          </div>
        ) : null}

        {/* Stage / arquivo — única linha truncada quando imprimindo */}
        {printing && (state?.stage || state?.currentFile) ? (
          <div
            className="text-muted-foreground truncate leading-tight"
            style={{ fontSize: 'clamp(0.6875rem, 1vw, 0.875rem)' }}
            title={state.currentFile ?? state.stage ?? ''}
          >
            {state?.stage && state.stage !== 'Imprimindo'
              ? state.stage
              : state?.currentFile ?? ''}
          </div>
        ) : null}
      </div>
    </Link>
  );
}

/**
 * Placeholder visual pro slot do objeto quando a impressora está
 * ociosa/concluída/erro. Mantém o mesmo container 1:1 do hero pra
 * que o card preserve a estrutura visual em qualquer estado —
 * dashboard de monitor não fica "pulando" entre layouts diferentes.
 */
function IdleObjectPlaceholder({ status }: { status: PrinterStatus }) {
  const label =
    status === 'FINISH'
      ? 'Concluída'
      : status === 'FAILED'
        ? 'Erro'
        : status === 'OFFLINE'
          ? 'Offline'
          : 'Sem trabalho';

  const Icon =
    status === 'FINISH'
      ? CheckCircle2
      : status === 'FAILED'
        ? AlertTriangle
        : status === 'OFFLINE'
          ? CloudOff
          : Circle;

  const tone =
    status === 'FINISH'
      ? 'text-success'
      : status === 'FAILED'
        ? 'text-danger'
        : 'text-muted-foreground';

  return (
    <div className="relative aspect-square rounded-xl border border-dashed border-border/50 bg-gradient-to-b from-muted/15 to-background/30 overflow-hidden flex flex-col items-center justify-center gap-2">
      <Icon
        className={cn('opacity-60', tone)}
        strokeWidth={1.2}
        style={{ width: 'clamp(2rem, 3.5vw, 3rem)', height: 'clamp(2rem, 3.5vw, 3rem)' }}
      />
      <span
        className={cn('uppercase tracking-wider font-mono', tone)}
        style={{ fontSize: 'clamp(0.625rem, 0.95vw, 0.8125rem)' }}
      >
        {label}
      </span>
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
