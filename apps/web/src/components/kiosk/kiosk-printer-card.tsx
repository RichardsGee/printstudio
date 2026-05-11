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
  Image as ImageIcon,
  PencilRuler,
} from 'lucide-react';
import type { PrinterState, PrinterStatus } from '@printstudio/shared';
import { Spool } from '@/components/spool';
import { KioskPrintObject } from '@/components/kiosk/kiosk-print-object';
import { RealisticPreview3D } from '@/components/realistic-preview-3d';
import { MissionGauge } from '@/components/kiosk/mission-gauge';
import { SensorPanel } from '@/components/kiosk/sensor-panel';
import { cn, formatDuration, formatEtaClock } from '@/lib/utils';

import { getBridgeBase } from '@/lib/bridge-url';

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
  // Modo sketch da imagem da impressora — toggle persistido em
  // localStorage (escolha global pra todos os cards).
  const [sketchMode, setSketchMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem('kiosk-printer-sketch') === '1';
  });

  // Detecta se há .3mf vinculado pra escolher render: 3D realista
  // (modelo com mesh) vs PNG com fill vertical (fallback).
  // Re-checa quando o arquivo muda OU window foca (caso o usuário
  // tenha subido .3mf no detail page enquanto kiosk estava aberto).
  const [hasUploadedModel, setHasUploadedModel] = useState<boolean | null>(null);
  const currentFile = state?.currentFile ?? null;
  useEffect(() => {
    let alive = true;
    const check = (): void => {
      fetch(`${getBridgeBase()}/api/printers/${printerId}/uploaded-model.info`)
        .then((r) => { if (alive) setHasUploadedModel(r.ok); })
        .catch(() => { if (alive) setHasUploadedModel(false); });
    };
    check();
    window.addEventListener('focus', check);
    // Re-checa a cada 60s — pra kiosk fixo (sem focus/blur natural).
    const interval = setInterval(check, 60_000);
    return () => {
      alive = false;
      window.removeEventListener('focus', check);
      clearInterval(interval);
    };
  }, [printerId, currentFile]);

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

  // Station ID derivado do printerId — primeiros 4 chars em uppercase.
  const stationId = `STN-${printerId.slice(0, 4).toUpperCase()}`;

  return (
    <div
      data-mc-card
      className={cn(
        'relative block rounded-2xl border-2 overflow-hidden',
        TONE_CLASSES[tone],
      )}
    >
      {/* Status header — formato Mission Control */}
      <div className={cn('px-4 py-2 flex items-center gap-2', TONE_HEADER_CLASSES[tone])}>
        <span
          data-mc-led
          className="shrink-0"
          aria-hidden
        />
        <StatusIcon status={status} />
        <span
          data-mc-label
          className="font-semibold uppercase tracking-wider"
          style={{ fontSize: 'clamp(0.75rem, 1.2vw, 1rem)' }}
        >
          {STATUS_LABELS[status]}
        </span>
        <span
          data-mc-id
          className="text-muted-foreground"
          style={{ fontSize: 'clamp(0.625rem, 0.95vw, 0.8125rem)' }}
        >
          {`// ${stationId}`}
        </span>
        <span
          className="ml-auto font-semibold tracking-tight truncate text-foreground"
          style={{ fontSize: 'clamp(0.875rem, 1.4vw, 1.125rem)' }}
        >
          {name}
        </span>
        {hmsCount > 0 ? (
          <span
            data-mc-label
            className="bg-danger px-2 py-0.5 font-bold text-danger-foreground"
            style={{ fontSize: 'clamp(0.6875rem, 1vw, 0.875rem)' }}
          >
            ! {hmsCount} ALERT{hmsCount > 1 ? 'S' : ''}
          </span>
        ) : null}
      </div>

      {/* HERO grid 2:3 (Bambu+Spool stacked | Objeto). A coluna do
          objeto é mais alta (aspect-square num slot 60% wider), então
          a coluna esquerda tem espaço sobrando abaixo da Bambu — o
          Spool ocupa esse espaço. */}
      <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-2 p-2.5 bg-gradient-to-b from-muted/30 to-background">
        <div className="flex flex-col gap-2 min-h-0">
          <Link
            href={`/printers/${printerId}`}
            aria-label={`Detalhes da ${name}`}
            className={cn(
              'relative aspect-square rounded-xl border border-border/60 bg-gradient-to-br from-muted/30 to-background overflow-hidden flex items-center justify-center',
              'transition-transform hover:scale-[1.02] active:scale-[0.98]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            )}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={sketchMode ? '/images/bambu-a1-blueprint.png' : '/images/bambu-a1.png'}
              alt={sketchMode ? 'Bambu Lab A1 (blueprint)' : 'Bambu Lab A1'}
              className={cn(
                'max-h-full max-w-full object-contain p-2 transition-opacity duration-300',
                sketchMode && 'kiosk-blueprint-tint',
              )}
              draggable={false}
            />
            <div
              data-mc-id
              className="absolute top-1.5 left-2 font-mono uppercase tracking-wider text-muted-foreground"
              style={{ fontSize: 'clamp(0.5625rem, 0.85vw, 0.75rem)' }}
            >
              A1 + AMS
            </div>

            {/* Toggle modo sketch / real — clique não navega (stopPropagation) */}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const next = !sketchMode;
                setSketchMode(next);
                if (typeof window !== 'undefined') {
                  window.localStorage.setItem('kiosk-printer-sketch', next ? '1' : '0');
                }
              }}
              className="absolute top-1.5 right-1.5 inline-flex items-center gap-1 rounded-md bg-background/80 backdrop-blur-sm border border-[var(--mc-accent-soft)] px-1.5 py-0.5 text-foreground hover:bg-background transition-colors"
              aria-label={sketchMode ? 'Ver imagem real' : 'Ver sketch técnico'}
              title={sketchMode ? 'IMAGE / REAL' : 'SKETCH / TECH'}
            >
              {sketchMode ? (
                <ImageIcon className="h-3 w-3" />
              ) : (
                <PencilRuler className="h-3 w-3" />
              )}
              <span
                data-mc-label
                style={{ fontSize: 'clamp(0.5rem, 0.75vw, 0.625rem)' }}
                className="uppercase tracking-wider"
              >
                {sketchMode ? 'REAL' : 'TECH'}
              </span>
            </button>
          </Link>

          {/* Painel de sensores no espaço sobrando — telemetria
              técnica (temps, fans, link) com gauges segmentados */}
          {printing ? (
            <div className="flex-1 min-h-0 flex items-stretch justify-center pt-1">
              <SensorPanel state={state} className="w-full" />
            </div>
          ) : null}
        </div>

        {printing ? (
          hasUploadedModel || state?.currentTaskPickUrl ? (
            // Renderiza preview 3D quando: (a) user uploadou .3mf (mesh
            // rotacionável) ou (b) Bambu Cloud forneceu vista isométrica
            // pra esse print (Story 4.7 — pick_1.png). O componente
            // decide internamente qual mostrar.
            <RealisticPreview3D
              printerId={printerId}
              currentLayer={state?.currentLayer ?? null}
              totalLayers={state?.totalLayers ?? null}
              progressPct={state?.progressPct ?? null}
              filamentColor={activeSlot?.color ?? null}
              accentColor="#22d3ee"
              cloudPickUrl={state?.currentTaskPickUrl ?? null}
              cloudBambuModelId={state?.currentBambuModelId ?? null}
              cloudPlateIndex={state?.currentPlateIndex ?? null}
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
              <Spool
                color={activeSlot.color ?? null}
                active
                rotating={status === 'PRINTING'}
                size={36}
                className="shrink-0"
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

        {/* Progress bar — gauge segmentado estilo HUD */}
        {printing ? <MissionGauge value={progress} /> : null}

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
              <span data-mc-num className="font-semibold text-foreground">
                {state?.currentLayer != null && state?.totalLayers != null
                  ? `${String(state.currentLayer).padStart(String(state.totalLayers).length, '0')}/${state.totalLayers}`
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
    </div>
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
  IDLE: '[STBY]',
  PREPARE: '[BOOT]',
  PRINTING: '[ACTIVE]',
  PAUSED: '[HOLD]',
  FINISH: '[OK]',
  FAILED: '[ERR]',
  OFFLINE: '[NO-LINK]',
  UNKNOWN: '[?]',
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

