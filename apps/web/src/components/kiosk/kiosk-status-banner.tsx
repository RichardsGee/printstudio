'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Printer } from 'lucide-react';
import type { PrinterState } from '@printstudio/shared';
import { KioskFullscreenButton } from '@/components/kiosk/kiosk-fullscreen-button';
import { cn } from '@/lib/utils';

interface Props {
  printers: { id: string; name: string }[];
  states: Record<string, PrinterState>;
}

/**
 * Banner topo do kiosk — agrega estado de todas as impressoras
 * em um só sinal visual. Vermelho se há erro em qualquer uma,
 * azul se há prints rodando, neutro se ociosas.
 */
export function KioskStatusBanner({ printers, states }: Props) {
  const now = useNow();

  const totals = printers.reduce(
    (acc, p) => {
      const s = states[p.id];
      const status = s?.status ?? 'UNKNOWN';
      if (s?.hmsErrors && s.hmsErrors.length > 0) acc.errors += 1;
      if (status === 'FAILED') acc.errors += 1;
      else if (status === 'PRINTING' || status === 'PREPARE') acc.printing += 1;
      else if (status === 'PAUSED') acc.paused += 1;
      else if (status === 'OFFLINE' || status === 'UNKNOWN') acc.offline += 1;
      else acc.idle += 1;
      return acc;
    },
    { errors: 0, printing: 0, paused: 0, idle: 0, offline: 0 },
  );

  const hasError = totals.errors > 0;
  const tone = hasError ? 'danger' : totals.printing > 0 ? 'info' : 'muted';

  return (
    <div
      data-mc-banner
      data-mc-glitch
      className={cn(
        'flex items-center justify-between gap-4 rounded-2xl border-2 px-5 py-3',
        BANNER_TONE[tone],
      )}
    >
      <div
        data-mc-id
        className="absolute -top-2 left-3 px-2 text-[10px] uppercase tracking-widest text-[var(--mc-accent)] bg-[var(--mc-bg)]"
      >
        ◢ MISSION CONTROL · STATION TEL-RJ-01
      </div>
      <div className="flex items-center gap-3 min-w-0">
        {hasError ? (
          <AlertTriangle
            className="shrink-0 animate-pulse"
            style={{ width: 'clamp(1.5rem, 2.5vw, 2.5rem)', height: 'clamp(1.5rem, 2.5vw, 2.5rem)' }}
          />
        ) : totals.printing > 0 ? (
          <Printer
            className="shrink-0"
            style={{ width: 'clamp(1.5rem, 2.5vw, 2.5rem)', height: 'clamp(1.5rem, 2.5vw, 2.5rem)' }}
          />
        ) : (
          <CheckCircle2
            className="shrink-0"
            style={{ width: 'clamp(1.5rem, 2.5vw, 2.5rem)', height: 'clamp(1.5rem, 2.5vw, 2.5rem)' }}
          />
        )}
        <div className="min-w-0">
          <div
            className="font-semibold leading-tight"
            style={{ fontSize: 'clamp(1rem, 1.8vw, 1.5rem)' }}
          >
            {hasError
              ? `${totals.errors} impressora${totals.errors > 1 ? 's' : ''} com erro`
              : totals.printing > 0
                ? `${totals.printing} impressora${totals.printing > 1 ? 's' : ''} imprimindo`
                : 'Tudo tranquilo'}
          </div>
          <div
            className="text-muted-foreground"
            style={{ fontSize: 'clamp(0.75rem, 1.1vw, 1rem)' }}
          >
            {printers.length} {printers.length === 1 ? 'impressora' : 'impressoras'} ·
            {totals.idle > 0 ? ` ${totals.idle} ocios${totals.idle > 1 ? 'as' : 'a'} ·` : ''}
            {totals.paused > 0 ? ` ${totals.paused} pausad${totals.paused > 1 ? 'as' : 'a'} ·` : ''}
            {totals.offline > 0 ? ` ${totals.offline} offline` : ''}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <KioskFullscreenButton />
        <div className="text-right">
        <div
          data-mc-num
          className="font-semibold leading-none"
          style={{ fontSize: 'clamp(1.5rem, 3vw, 2.5rem)' }}
        >
          {now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
        </div>
        <div
          data-mc-id
          className="text-muted-foreground"
          style={{ fontSize: 'clamp(0.5625rem, 0.85vw, 0.75rem)' }}
        >
          UTC{getTzOffset(now)} · LAT -22.9068 · LON -43.1729
        </div>
        </div>
      </div>
    </div>
  );
}

function getTzOffset(d: Date): string {
  const off = -d.getTimezoneOffset() / 60;
  const sign = off >= 0 ? '+' : '-';
  return `${sign}${String(Math.abs(off)).padStart(2, '0')}:00`;
}

function useNow(): Date {
  const [now, setNow] = useState<Date>(() => new Date());
  useEffect(() => {
    // Tick a cada segundo pro relógio em formato HH:MM:SS atualizar.
    // Custo barato: o banner tá sempre montado e o re-render é leve.
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);
  return now;
}

type BannerTone = 'danger' | 'info' | 'muted';

const BANNER_TONE: Record<BannerTone, string> = {
  danger: 'border-danger/60 bg-danger/10 text-danger',
  info: 'border-primary/30 bg-primary/5 text-foreground',
  muted: 'border-border/60 bg-card text-foreground',
};
