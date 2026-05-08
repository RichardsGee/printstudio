'use client';

import { useEffect, useState } from 'react';
import { Scale } from 'lucide-react';
import { cn } from '@/lib/utils';

import { getApiBase } from '@/lib/bridge-url';

interface Props {
  printerId: string;
  /** Refresh trigger: muda quando um job termina pra re-buscar. */
  refreshKey?: string | number | null;
  className?: string;
}

interface Stats {
  totalFilamentG: number;
  totalJobs: number;
}

/**
 * Soma lifetime de filamento usado por esta impressora, vinda da
 * agregação de `print_jobs.filament_used_g` no endpoint `/api/stats`.
 * Mostrado em kg quando passa de 1000g, senão em g.
 */
export function FilamentTotal({ printerId, refreshKey, className }: Props) {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`${getApiBase()}/api/stats?printerId=${printerId}`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        if (!alive) return;
        setStats({
          totalFilamentG: Number(d.totalFilamentG ?? 0),
          totalJobs: Number(d.totalJobs ?? 0),
        });
      })
      .catch(() => {
        if (!alive) return;
        setStats({ totalFilamentG: 0, totalJobs: 0 });
      });
    return () => {
      alive = false;
    };
  }, [printerId, refreshKey]);

  if (!stats) return null;

  const total = stats.totalFilamentG;
  const display =
    total >= 1000 ? `${(total / 1000).toFixed(2)} kg` : `${total.toFixed(0)} g`;

  return (
    <div
      className={cn(
        'rounded-md border border-border/60 bg-gradient-to-b from-primary/10 to-primary/5 px-2.5 py-1.5 flex flex-col gap-0.5',
        className,
      )}
    >
      <div className="flex items-center gap-1.5 text-[9px] font-mono uppercase tracking-wider text-muted-foreground">
        <Scale className="h-3 w-3" />
        Total usado
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-sm font-semibold tabular-nums text-primary">{display}</span>
        <span className="text-[10px] text-muted-foreground">
          · {stats.totalJobs} {stats.totalJobs === 1 ? 'impressão' : 'impressões'}
        </span>
      </div>
    </div>
  );
}
