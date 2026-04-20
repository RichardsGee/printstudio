'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, Clock3, Printer as PrinterIcon, Percent } from 'lucide-react';
import { cn } from '@/lib/utils';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

interface StatsResponse {
  totalJobs: number;
  success: number;
  failed: number;
  cancelled: number;
  running: number;
  successRate: number | null;
  totalDurationSec: number;
  avgDurationSec: number;
  failuresByHour: Array<{ hour: number; count: number }>;
}

function formatHours(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const hours = sec / 3600;
  if (hours < 1) return `${Math.round(sec / 60)}min`;
  return `${hours.toFixed(1)}h`;
}

export function StatsStrip({ printerId }: { printerId?: string }) {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    const url = printerId
      ? `${API_URL}/api/stats?printerId=${printerId}`
      : `${API_URL}/api/stats`;
    fetch(url)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: StatsResponse) => {
        if (alive) {
          setStats(data);
          setLoaded(true);
        }
      })
      .catch(() => {
        if (alive) setLoaded(true);
      });
    return () => {
      alive = false;
    };
  }, [printerId]);

  if (!loaded) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs text-muted-foreground">
        <StatCell icon={PrinterIcon} label="Total" value="…" />
        <StatCell icon={CheckCircle2} label="Sucesso" value="…" />
        <StatCell icon={XCircle} label="Falhas" value="…" />
        <StatCell icon={Percent} label="Taxa" value="…" />
        <StatCell icon={Clock3} label="Tempo total" value="…" />
      </div>
    );
  }

  if (!stats || stats.totalJobs === 0) {
    return (
      <div className="text-xs text-muted-foreground italic py-2">
        Sem histórico de impressões ainda. As estatísticas aparecerão assim que houver jobs registrados.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
      <StatCell
        icon={PrinterIcon}
        label="Total"
        value={String(stats.totalJobs)}
        sub={`${stats.running} rodando`}
      />
      <StatCell
        icon={CheckCircle2}
        label="Sucesso"
        value={String(stats.success)}
        tone="ok"
      />
      <StatCell
        icon={XCircle}
        label="Falhas"
        value={String(stats.failed)}
        tone={stats.failed > 0 ? 'warn' : undefined}
      />
      <StatCell
        icon={Percent}
        label="Taxa"
        value={stats.successRate !== null ? `${Math.round(stats.successRate * 100)}%` : '—'}
        tone={stats.successRate !== null && stats.successRate >= 0.85 ? 'ok' : undefined}
      />
      <StatCell
        icon={Clock3}
        label="Tempo total"
        value={formatHours(stats.totalDurationSec)}
        sub={stats.avgDurationSec > 0 ? `méd. ${formatHours(stats.avgDurationSec)}` : undefined}
      />
    </div>
  );
}

function StatCell({
  icon: Icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  tone?: 'ok' | 'warn';
}) {
  return (
    <div
      className={cn(
        'rounded-md border px-2.5 py-2 flex flex-col gap-0.5',
        tone === 'ok'
          ? 'border-emerald-500/40 bg-emerald-500/5'
          : tone === 'warn'
            ? 'border-amber-500/40 bg-amber-500/5'
            : 'border-border/60 bg-card',
      )}
    >
      <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className="text-lg font-semibold tabular-nums leading-none">{value}</div>
      {sub ? <div className="text-[10px] text-muted-foreground">{sub}</div> : null}
    </div>
  );
}
