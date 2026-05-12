'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Pause,
  Play,
  Square,
  Thermometer,
  Flame,
  Wind,
  HardDrive,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { toast } from 'sonner';
import type { CommandAction, PrinterEvent } from '@printstudio/shared';
import { useConnection } from '@/lib/connection';
import { WsClient } from '@/lib/ws-client';
import { usePrinterStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/status-badge';
import { AmsDisplay } from '@/components/ams-display';
import { HmsErrorsCard } from '@/components/hms-errors-card';
import { CameraStream } from '@/components/camera-stream';
import { StatsStrip } from '@/components/stats-strip';
import { FilamentSwatch } from '@/components/filament-swatch';
import { SpeedModeIndicator } from '@/components/speed-mode-indicator';
import { WifiIndicator } from '@/components/wifi-indicator';
import { FansDisplay } from '@/components/fans-display';
import { StatRow } from '@/components/stat-row';
import { PrintPreview } from '@/components/print-preview';
import { PtfeTube } from '@/components/ptfe-tube';
import { PowerUsage } from '@/components/power-usage';
import { FilamentUsage } from '@/components/filament-usage';
import { FilamentTotal } from '@/components/filament-total';
import { UploadCachedModel } from '@/components/upload-cached-model';
import { cn, formatDateTime, formatDuration, formatEtaClock } from '@/lib/utils';

interface Props {
  printerId: string;
  name: string;
}

interface TempPoint {
  t: number;
  nozzle: number | null;
  bed: number | null;
  chamber?: number | null;
}

const TEMP_WINDOW_HOURS = 24;
import { getApiBase } from '@/lib/bridge-url';

export function PrinterDetailClient({ printerId, name }: Props) {
  const { wsUrl, detecting } = useConnection();
  const state = usePrinterStore((s) => s.states[printerId]);
  const setState = usePrinterStore((s) => s.setState);
  const pushEvent = usePrinterStore((s) => s.pushEvent);
  const [history, setHistory] = useState<TempPoint[]>([]);
  const [events, setEvents] = useState<PrinterEvent[]>([]);
  // Bumped pelo UploadCachedModel após upload — força PrintPreview
  // remontar e re-buscar o mesh, sem reload da página (preserva logs
  // do DevTools).
  const [cachedVersion, setCachedVersion] = useState(0);
  const clientRef = useRef<WsClient | null>(null);

  // Carrega histórico de 24h do endpoint na montagem, e depois vai
  // recebendo atualizações em tempo real via WS — amostras novas
  // chegam a ~1/min (matching do throttle de insert no bridge-relay).
  useEffect(() => {
    let alive = true;
    fetch(`${getApiBase()}/api/printers/${printerId}/temperatures?hours=${TEMP_WINDOW_HOURS}`, {
      credentials: 'include',
    })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: { points: Array<{ t: string; nozzle: number | null; bed: number | null; chamber: number | null }> }) => {
        if (!alive) return;
        setHistory(
          data.points.map((p) => ({
            t: new Date(p.t).getTime(),
            nozzle: p.nozzle,
            bed: p.bed,
            chamber: p.chamber,
          })),
        );
      })
      .catch(() => {
        /* se falhar, o histórico ficará vazio até o WS popular */
      });
    return () => {
      alive = false;
    };
  }, [printerId]);

  useEffect(() => {
    if (detecting) return;
    const client = new WsClient(wsUrl);
    clientRef.current = client;

    let lastAppend = 0;
    const off = client.onMessage((msg) => {
      if (msg.type === 'printer.state' && msg.payload.printerId === printerId) {
        setState(msg.payload);
        // Appenda 1 ponto/min no histórico local — alinhado com o
        // throttle do backend. Drops pontos > 24h atrás.
        const now = Date.now();
        if (now - lastAppend >= 60_000) {
          lastAppend = now;
          setHistory((h) => {
            const cutoff = now - TEMP_WINDOW_HOURS * 3_600_000;
            return [
              ...h.filter((p) => p.t > cutoff),
              {
                t: now,
                nozzle: msg.payload.nozzleTemp,
                bed: msg.payload.bedTemp,
                chamber: msg.payload.chamberTemp,
              },
            ];
          });
        }
      } else if (msg.type === 'printer.event' && msg.payload.printerId === printerId) {
        pushEvent(msg.payload);
        setEvents((e) => [msg.payload, ...e].slice(0, 30));
      }
    });

    client.connect();
    client.subscribe([printerId]);

    return () => {
      off();
      client.close();
    };
  }, [wsUrl, detecting, printerId, setState, pushEvent]);

  function send(action: CommandAction) {
    clientRef.current?.command(printerId, action);
    toast.message(`Comando enviado: ${action}`);
  }

  const chartData = useMemo(
    () =>
      history.map((h) => ({
        ...h,
        t: new Date(h.t).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      })),
    [history],
  );

  const activeSlot =
    state?.amsSlots.find((s) => s.active) ??
    (state?.activeSlotIndex != null
      ? state.amsSlots.find((s) => s.slot === state.activeSlotIndex) ?? null
      : null);

  const progress = state?.progressPct ?? 0;

  return (
    <div className="space-y-4">
      {/* ═══ HEADER ═══ Identificação + status + controles (single row) */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1 min-w-0">
          <div data-mc-id className="text-caption text-primary uppercase tracking-wider">
            {`// PRINTER · STN-${printerId.slice(0, 4).toUpperCase()}`}
          </div>
          <div className="flex items-baseline gap-3 flex-wrap">
            <h1 className="text-heading uppercase tracking-wider">{name}</h1>
            <StatusBadge status={state?.status ?? 'UNKNOWN'} />
            {shouldShowStage(state?.status, state?.stage) ? (
              <span
                data-mc-label
                className="inline-flex items-center gap-1 text-caption uppercase tracking-wider border border-[var(--mc-accent-soft)]/40 bg-muted/40 text-muted-foreground px-1.5 py-0.5"
              >
                {state!.stage}
              </span>
            ) : null}
            {state?.isFromSdCard ? (
              <span
                data-mc-label
                className="inline-flex items-center gap-1 text-caption uppercase tracking-wider text-muted-foreground"
              >
                <HardDrive className="h-3 w-3" />
                SD
              </span>
            ) : null}
          </div>
          {state?.stateChangeReason ? (
            <div className="text-small text-muted-foreground">
              {state.stateChangeReason}
            </div>
          ) : null}
        </div>
        {/* Controles — full-width em mobile pra touch, inline em sm+ */}
        <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto sm:shrink-0">
          <Button
            variant="outline"
            onClick={() => send('pause')}
            className="uppercase tracking-wider h-11 sm:h-9 flex-1 sm:flex-initial"
          >
            <Pause className="h-4 w-4 mr-1.5" /> Pausar
          </Button>
          <Button
            variant="outline"
            onClick={() => send('resume')}
            className="uppercase tracking-wider h-11 sm:h-9 flex-1 sm:flex-initial"
          >
            <Play className="h-4 w-4 mr-1.5" /> Retomar
          </Button>
          <Button
            variant="destructive"
            onClick={() => send('stop')}
            className="uppercase tracking-wider h-11 sm:h-9 flex-1 sm:flex-initial"
          >
            <Square className="h-4 w-4 mr-1.5" /> Parar
          </Button>
        </div>
      </div>

      {/* HMS alerts (só renderiza se houver) */}
      <HmsErrorsCard errors={state?.hmsErrors ?? []} />

      {/* ═══ HERO ═══ Missão atual: preview + info + progresso + pills */}
      <Card data-mc-card>
        <CardHeader className="pb-2 flex-row items-center justify-between gap-2">
          <CardTitle className="text-body uppercase tracking-wider">Missão atual</CardTitle>
          {state?.currentBambuModelId ? (
            <UploadCachedModel
              key={`${state.currentBambuModelId}-${state.currentPlateIndex ?? 1}`}
              bambuModelId={state.currentBambuModelId}
              currentPlateIndex={state.currentPlateIndex ?? null}
              onUploaded={() => {
                // Bump versão pro PrintPreview re-buscar o mesh
                // (sem perder logs do DevTools).
                setCachedVersion((v) => v + 1);
              }}
            />
          ) : null}
        </CardHeader>
        <CardContent className="space-y-4 pb-4">
          <div className="grid md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-4 items-start">
            {/* Preview 3D (col 1 — quadrado) */}
            <PrintPreview
              key={`pp-${cachedVersion}`}
              printerId={printerId}
              cacheKey={state?.currentFile ?? null}
              currentLayer={state?.currentLayer ?? null}
              totalLayers={state?.totalLayers ?? null}
              progressPct={state?.progressPct ?? null}
              filamentColor={activeSlot?.color ?? null}
              cloudPickUrl={state?.currentTaskPickUrl ?? null}
              cloudBambuModelId={state?.currentBambuModelId ?? null}
              cloudPlateIndex={state?.currentPlateIndex ?? null}
            />

            {/* Info + Progresso (col 2 — wider) */}
            <div className="space-y-4 min-w-0">
              {/* Linha arquivo + filamento, 2 cols com baseline alinhada */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="min-w-0">
                  <div
                    data-mc-label
                    className="text-caption uppercase tracking-wider text-muted-foreground mb-1"
                  >
                    Arquivo
                  </div>
                  <div
                    data-mc-id
                    className="text-small font-medium truncate"
                    title={state?.currentFile ?? ''}
                  >
                    {state?.currentFile ?? '—'}
                  </div>
                </div>
                {activeSlot ? (
                  <div className="min-w-0">
                    <div
                      data-mc-label
                      className="text-caption uppercase tracking-wider text-muted-foreground mb-1"
                    >
                      Filamento
                    </div>
                    <div className="flex items-center gap-1.5">
                      <FilamentSwatch color={activeSlot.color ?? null} active size="sm" />
                      <span className="text-small truncate">
                        {activeSlot.filamentType ?? 'Filamento'}
                        {' · '}
                        <span data-mc-num>SLOT {activeSlot.slot + 1}</span>
                      </span>
                    </div>
                  </div>
                ) : (
                  <div />
                )}
              </div>

              {/* Progresso + Camadas (stacked, mesma largura) */}
              <div className="space-y-3">
                <ProgressMetric
                  label="Progresso"
                  primary={`${progress.toFixed(1)}%`}
                  percent={progress}
                  accent="primary"
                />
                <ProgressMetric
                  label="Camadas"
                  primary={
                    state?.currentLayer != null && state?.totalLayers != null
                      ? `${state.currentLayer}/${state.totalLayers}`
                      : '—'
                  }
                  percent={
                    state?.currentLayer != null && state?.totalLayers
                      ? (state.currentLayer / state.totalLayers) * 100
                      : 0
                  }
                  accent="emerald"
                />
              </div>

              {/* 4 pills uniformes (mesmo height/width via grid-cols-4) */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-3 border-t border-[var(--mc-accent-soft)]/30">
                <InfoPill label="ETA" value={formatEtaClock(state?.remainingSec)} />
                <InfoPill label="RESTANTE" value={formatDuration(state?.remainingSec)} />
                <InfoPill
                  label="VELOCIDADE"
                  value={
                    state?.speedPercent != null ? `${Math.round(state.speedPercent)}%` : '—'
                  }
                />
                <div className="border border-[var(--mc-accent-soft)]/30 bg-gradient-to-b from-muted/30 to-muted/10 px-2.5 py-1.5 flex flex-col gap-0.5">
                  <FilamentTotal
                    printerId={printerId}
                    refreshKey={state?.status === 'FINISH' ? state.updatedAt : null}
                  />
                  <FilamentUsage
                    printerId={printerId}
                    cacheKey={state?.currentFile ?? null}
                    progressPct={progress}
                  />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ═══ TELEMETRIA ═══ 3 cards iguais (Câmera · Sensores · Impressora+AMS) */}
      <div className="grid gap-3 lg:grid-cols-3 lg:auto-rows-fr">
        {/* CARD 1 — Câmera ao vivo */}
        <Card data-mc-card className="flex flex-col">
          <CardHeader className="pb-2 flex-row items-center justify-between">
            <CardTitle className="text-body uppercase tracking-wider">Câmera</CardTitle>
            <div className="flex items-center gap-2">
              <SpeedModeIndicator mode={state?.speedMode ?? null} percent={state?.speedPercent} />
              <WifiIndicator dbm={state?.wifiSignalDbm ?? null} />
            </div>
          </CardHeader>
          <CardContent className="pb-3 flex-1 flex items-stretch">
            <div className="w-full">
              <CameraStream printerId={printerId} />
            </div>
          </CardContent>
        </Card>

        {/* CARD 2 — Sensores (temps + fans + bico info) */}
        <Card data-mc-card className="flex flex-col">
          <CardHeader className="pb-2 flex-row items-center justify-between">
            <CardTitle className="text-body uppercase tracking-wider">Sensores</CardTitle>
            <PowerUsage state={state} />
          </CardHeader>
          <CardContent className="space-y-3 pb-3 flex-1">
            <div className="space-y-1">
              <div
                data-mc-label
                className="text-caption uppercase tracking-wider text-muted-foreground"
              >
                Temperaturas
              </div>
              <StatRow
                icon={Thermometer}
                label="Bico"
                value={formatTempWithTarget(state?.nozzleTemp, state?.nozzleTargetTemp)}
                tone="warn"
              />
              <StatRow
                icon={Flame}
                label="Mesa"
                value={formatTempWithTarget(state?.bedTemp, state?.bedTargetTemp)}
                tone="warn"
              />
              <StatRow
                icon={Wind}
                label="Câmara"
                value={formatTempOnly(state?.chamberTemp)}
                tone="muted"
              />
            </div>

            <div className="space-y-1 pt-3 border-t border-[var(--mc-accent-soft)]/30">
              <div
                data-mc-label
                className="text-caption uppercase tracking-wider text-muted-foreground"
              >
                Ventoinhas
              </div>
              <FansDisplay
                part={state?.fanPartCoolingPct ?? null}
                aux={state?.fanAuxPct ?? null}
                chamber={state?.fanChamberPct ?? null}
                heatbreak={state?.fanHeatbreakPct ?? null}
              />
            </div>

            {state?.nozzleDiameter || state?.nozzleType ? (
              <div
                data-mc-label
                className="text-caption text-muted-foreground pt-3 border-t border-[var(--mc-accent-soft)]/30 uppercase tracking-wider"
              >
                Bico{' '}
                {state?.nozzleDiameter ? `${state.nozzleDiameter}mm` : ''}{' '}
                {state?.nozzleType ? state.nozzleType.replace(/_/g, ' ') : ''}
              </div>
            ) : null}
          </CardContent>
        </Card>

        {/* CARD 3 — Impressora física + AMS + fluxo PTFE */}
        <Card data-mc-card className="flex flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="text-body uppercase tracking-wider">
              Impressora + AMS
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pb-3 flex-1 flex flex-col">
            <div className="relative aspect-[3/2] bg-gradient-to-br from-muted/30 to-background border border-[var(--mc-accent-soft)]/30 overflow-hidden flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/bambu-a1.png"
                alt="Bambu Lab A1"
                draggable={false}
                className="max-h-full max-w-full object-contain p-2"
              />
              <div
                data-mc-label
                className="absolute top-1.5 left-2 text-caption uppercase tracking-wider text-muted-foreground"
              >
                A1 + AMS
              </div>
            </div>

            <AmsDisplay
              slots={state?.amsSlots ?? []}
              units={state?.amsUnits ?? []}
              model="A1"
              bare
            />

            <div className="flex items-center gap-2 pt-3 border-t border-[var(--mc-accent-soft)]/30 mt-auto">
              <span
                data-mc-label
                className="text-caption uppercase tracking-wider text-muted-foreground shrink-0"
              >
                AMS → BICO
              </span>
              <PtfeTube
                color={activeSlot?.color ?? null}
                active={state?.status === 'PRINTING'}
                className="flex-1"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ═══ HISTÓRICO ═══ Chart 24H (2/3) + Eventos (1/3) */}
      <div className="grid gap-3 lg:grid-cols-3">
        <Card data-mc-card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-body uppercase tracking-wider">
              Temperaturas{' '}
              <span className="text-caption text-muted-foreground normal-case tracking-normal">
                · últimas 24h
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="h-40 pb-3">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="t" fontSize={10} stroke="hsl(var(--muted-foreground))" />
                <YAxis fontSize={10} stroke="hsl(var(--muted-foreground))" />
                <Tooltip
                  contentStyle={{
                    background: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    fontSize: 12,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="nozzle"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                  name="Bico"
                />
                <Line
                  type="monotone"
                  dataKey="bed"
                  stroke="#38bdf8"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                  name="Mesa"
                />
                <Line
                  type="monotone"
                  dataKey="chamber"
                  stroke="#a78bfa"
                  strokeWidth={1.5}
                  dot={false}
                  isAnimationActive={false}
                  name="Câmara"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card data-mc-card>
          <CardHeader className="pb-2">
            <CardTitle className="text-body uppercase tracking-wider">Eventos recentes</CardTitle>
          </CardHeader>
          <CardContent className="pb-3">
            {events.length === 0 ? (
              <div className="text-small text-muted-foreground">Sem eventos.</div>
            ) : (
              <ul className="space-y-1.5 text-small max-h-36 overflow-y-auto">
                {events.map((ev, i) => (
                  <li
                    key={ev.id ?? `${ev.createdAt}-${i}`}
                    className="flex gap-2 justify-between"
                  >
                    <span className="truncate">{ev.message}</span>
                    <span
                      data-mc-num
                      className="text-caption text-muted-foreground shrink-0"
                    >
                      {formatDateTime(ev.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ═══ STATS LIFETIME ═══ Strip horizontal no rodapé */}
      <StatsStrip printerId={printerId} />
    </div>
  );
}

/**
 * Quando o status já é claro (IMPRIMINDO/CONCLUÍDO/etc.), esconder
 * stages "triviais" que ficam stuck ou são redundantes com o status.
 * Só mostra stage durante PRINTING quando é algo genuinamente
 * diferente do "toca fita normal" (pausas, troca de filamento,
 * operações finais etc.).
 */
const NOTABLE_STAGES_WHILE_PRINTING = new Set([
  // Calibração / preparação antes da primeira camada
  'Preparando',
  'Nivelando mesa',
  'Pré-aquecendo mesa',
  'Aquecendo bico',
  'Limpando bico',
  'Limpando ponta do bico',
  'Verificando fluxo',
  'Verificando temperatura do bico',
  'Calibrando Z',
  'Calibrando extrusão',
  'Calibrando fluxo de extrusão',
  'Calibrando Micro Lidar',
  'Calibrando ruído do motor',
  'Calibrando temperatura do hotend',
  'Scanning da mesa',
  'Inspecionando primeira camada',
  'Identificando placa',
  'Homing',
  'Carregando filamento',
  'Descarregando filamento',
  // Pausas e finalização
  'Trocando filamento',
  'Pausa M400',
  'Pausa por acabou filamento',
  'Pausado',
  'Pausado pelo usuário',
  'Pausa por tampa aberta',
  'Pausa por temperatura do bico',
  'Pausa por temperatura da mesa',
  'Pausa por AMS desconectado',
  'Pausa por ventoinha lenta',
  'Pausa por temperatura da câmara',
  'Pausa via G-code',
  'Cortando filamento',
  'Guardando arquivo',
  'Encerrando impressão',
  'Finalizando',
]);

function shouldShowStage(status: string | undefined, stage: string | null | undefined): boolean {
  if (!stage) return false;
  if (status === 'PRINTING') return NOTABLE_STAGES_WHILE_PRINTING.has(stage);
  return true;
}

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-[var(--mc-accent-soft)]/30 bg-gradient-to-b from-muted/30 to-muted/10 px-2.5 py-1.5 flex flex-col gap-0.5">
      <span
        data-mc-label
        className="text-caption uppercase tracking-wider text-muted-foreground"
      >
        {label}
      </span>
      <span data-mc-num className="text-small font-semibold leading-tight">
        {value}
      </span>
    </div>
  );
}

function ProgressMetric({
  label,
  primary,
  percent,
  accent,
}: {
  label: string;
  primary: string;
  percent: number;
  accent: 'primary' | 'emerald';
}) {
  const clamped = Math.max(0, Math.min(100, percent));
  const barColor =
    accent === 'primary'
      ? 'bg-gradient-to-r from-primary/80 to-primary'
      : 'bg-gradient-to-r from-emerald-500/80 to-emerald-400';
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <span
          data-mc-label
          className="text-caption uppercase tracking-wider text-muted-foreground"
        >
          {label}
        </span>
        <span data-mc-num className="text-small font-semibold">
          {primary}
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted/60 overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-500 ease-out', barColor)}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}

function formatTempWithTarget(
  current: number | null | undefined,
  target: number | null | undefined,
): string {
  if (current == null) return '—';
  const c = current.toFixed(1);
  if (target == null || target === 0) return `${c}°C`;
  return `${c}°C / ${Math.round(target)}°`;
}

function formatTempOnly(current: number | null | undefined): string {
  if (current == null) return '—';
  return `${current.toFixed(1)}°C`;
}
