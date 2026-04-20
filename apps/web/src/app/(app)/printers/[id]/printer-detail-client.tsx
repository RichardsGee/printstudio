'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Pause,
  Play,
  Square,
  Clock,
  Thermometer,
  Flame,
  Wind,
  FileText,
  DoorOpen,
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
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export function PrinterDetailClient({ printerId, name }: Props) {
  const { wsUrl, detecting } = useConnection();
  const state = usePrinterStore((s) => s.states[printerId]);
  const setState = usePrinterStore((s) => s.setState);
  const pushEvent = usePrinterStore((s) => s.pushEvent);
  const [history, setHistory] = useState<TempPoint[]>([]);
  const [events, setEvents] = useState<PrinterEvent[]>([]);
  const clientRef = useRef<WsClient | null>(null);

  // Carrega histórico de 24h do endpoint na montagem, e depois vai
  // recebendo atualizações em tempo real via WS — amostras novas
  // chegam a ~1/min (matching do throttle de insert no bridge-relay).
  useEffect(() => {
    let alive = true;
    fetch(`${API_URL}/api/printers/${printerId}/temperatures?hours=${TEMP_WINDOW_HOURS}`, {
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
    <div className="space-y-3">
      {/* Header compacto */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Impressora</div>
          <h1 className="text-xl font-semibold tracking-tight flex items-center gap-3">
            {name}
            <StatusBadge status={state?.status ?? 'UNKNOWN'} />
            {state?.doorOpen ? (
              <span className="inline-flex items-center gap-1 text-xs font-mono rounded-md border border-amber-500/60 bg-amber-500/15 text-amber-200 px-1.5 py-0.5">
                <DoorOpen className="h-3 w-3" />
                PORTA ABERTA
              </span>
            ) : null}
            {state?.isFromSdCard ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                <HardDrive className="h-3 w-3" />
                SD
              </span>
            ) : null}
          </h1>
          {state?.stage ? (
            <div className="text-xs text-muted-foreground mt-0.5">
              {state.stage}
              {state?.stateChangeReason ? ` — ${state.stateChangeReason}` : ''}
            </div>
          ) : null}
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => send('pause')}>
            <Pause className="h-4 w-4 mr-1.5" /> Pausar
          </Button>
          <Button size="sm" variant="outline" onClick={() => send('resume')}>
            <Play className="h-4 w-4 mr-1.5" /> Retomar
          </Button>
          <Button size="sm" variant="destructive" onClick={() => send('stop')}>
            <Square className="h-4 w-4 mr-1.5" /> Parar
          </Button>
        </div>
      </div>

      {/* HMS alerts (só renderiza se houver) */}
      <HmsErrorsCard errors={state?.hmsErrors ?? []} />

      {/* Painel da impressora — A1 compacta + AMS, tudo numa linha curta */}
      <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
        <div className="grid md:grid-cols-[minmax(130px,160px)_1fr] items-stretch">
          <div className="relative bg-gradient-to-br from-muted/30 to-background md:border-r border-border/60 flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/bambu-a1.png"
              alt="Bambu Lab A1"
              draggable={false}
              className="max-h-36 max-w-full object-contain p-2"
            />
            <div className="absolute top-1.5 left-2 text-[9px] font-mono uppercase tracking-wider text-muted-foreground">
              A1 + AMS
            </div>
          </div>
          <div className="p-2.5 space-y-2">
            <AmsDisplay
              slots={state?.amsSlots ?? []}
              units={state?.amsUnits ?? []}
              model="A1"
              bare
            />
            {/* PTFE entre AMS e extrusor — filamento em trânsito */}
            <div className="flex items-center gap-2 px-1">
              <span className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground shrink-0">
                AMS → bico
              </span>
              <PtfeTube
                color={activeSlot?.color ?? null}
                active={state?.status === 'PRINTING'}
                className="flex-1"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Grade principal: câmera + impressão atual + sensores na mesma linha */}
      <div className="grid gap-3 lg:grid-cols-12">
        <Card className="lg:col-span-4">
          <CardHeader className="pb-2 flex-row items-center justify-between">
            <CardTitle className="text-sm">Câmera</CardTitle>
            <div className="flex items-center gap-2">
              <SpeedModeIndicator mode={state?.speedMode ?? null} percent={state?.speedPercent} />
              <WifiIndicator dbm={state?.wifiSignalDbm ?? null} />
            </div>
          </CardHeader>
          <CardContent className="pb-3">
            <CameraStream printerId={printerId} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Impressão atual</CardTitle>
          </CardHeader>
          <CardContent className="pb-3 space-y-3">
            {/* Linha superior: preview + arquivo + filamento */}
            <div className="grid grid-cols-[10rem_1fr] gap-3 items-center">
              <PrintPreview
                printerId={printerId}
                cacheKey={state?.currentFile ?? null}
                currentLayer={state?.currentLayer ?? null}
                totalLayers={state?.totalLayers ?? null}
                filamentColor={activeSlot?.color ?? null}
              />

              <div className="min-w-0 space-y-2">
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                    Arquivo
                  </div>
                  <div className="text-sm font-medium truncate" title={state?.currentFile ?? ''}>
                    {state?.currentFile ?? '—'}
                  </div>
                </div>

                {activeSlot ? (
                  <div>
                    <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                      Filamento
                    </div>
                    <div className="flex items-center gap-1.5">
                      <FilamentSwatch color={activeSlot.color ?? null} active size="sm" />
                      <span className="text-xs truncate">
                        {activeSlot.filamentType ?? 'Filamento'} — slot {activeSlot.slot + 1}
                      </span>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            {/* Tubo PTFE com filamento animado — visual só quando imprimindo */}
            <PtfeTube
              color={activeSlot?.color ?? null}
              active={state?.status === 'PRINTING'}
            />

            {/* Progresso geral + camadas — mesmo estilo, valores grandes */}
            <div className="space-y-2.5">
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

            {/* Footer: ETA + restante + velocidade, alinhado em grid regular */}
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/40 text-xs">
              <InfoPill label="Termina às" value={formatEtaClock(state?.remainingSec)} />
              <InfoPill label="Restante" value={formatDuration(state?.remainingSec)} />
              <InfoPill
                label="Velocidade"
                value={
                  state?.speedPercent != null ? `${Math.round(state.speedPercent)}%` : '—'
                }
              />
            </div>
          </CardContent>
        </Card>

        {/* Sensores compactos ao lado, stacked vertical */}
        <Card className="lg:col-span-3">
          <CardHeader className="pb-2 flex-row items-center justify-between">
            <CardTitle className="text-sm">Sensores</CardTitle>
            <PowerUsage state={state} />
          </CardHeader>
          <CardContent className="space-y-3 pb-3">
            <div className="space-y-1">
              <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
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

            <div className="space-y-1 pt-2 border-t border-border/40">
              <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
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
              <div className="text-[10px] text-muted-foreground pt-2 border-t border-border/40">
                Bico{' '}
                {state?.nozzleDiameter ? `${state.nozzleDiameter}mm` : ''}{' '}
                {state?.nozzleType ? state.nozzleType.replace(/_/g, ' ') : ''}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {/* Stats lifetime da impressora */}
      <StatsStrip printerId={printerId} />

      {/* Chart + Eventos lado a lado */}
      <div className="grid gap-3 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Temperaturas — últimas 24h</CardTitle>
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

      {/* Events — coluna ao lado do chart */}
      <Card className="lg:col-span-1">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Eventos recentes</CardTitle>
        </CardHeader>
        <CardContent className="pb-3">
          {events.length === 0 ? (
            <div className="text-xs text-muted-foreground">Sem eventos.</div>
          ) : (
            <ul className="space-y-1.5 text-xs max-h-36 overflow-y-auto">
              {events.map((ev, i) => (
                <li
                  key={ev.id ?? `${ev.createdAt}-${i}`}
                  className="flex gap-2 justify-between"
                >
                  <span className="truncate">{ev.message}</span>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {formatDateTime(ev.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      </div>
    </div>
  );
}

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border/60 bg-gradient-to-b from-muted/30 to-muted/10 px-2.5 py-1.5 flex flex-col gap-0.5">
      <span className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className="text-sm font-semibold tabular-nums leading-tight">{value}</span>
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
        <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <span className="text-sm font-semibold tabular-nums">{primary}</span>
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
