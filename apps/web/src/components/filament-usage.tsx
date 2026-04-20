'use client';

import { useEffect, useState } from 'react';
import { Scale } from 'lucide-react';
import { cn } from '@/lib/utils';

const LAN_HOST = process.env.NEXT_PUBLIC_LAN_DISCOVERY_HOST ?? 'localhost';
const LAN_PORT = process.env.NEXT_PUBLIC_LAN_DISCOVERY_PORT ?? '8080';

interface Meta {
  filamentWeightG: number[];
  filamentLengthMm: number[];
}

interface Props {
  printerId: string;
  cacheKey?: string | null;
  /** 0..100 — progresso atual reportado pela impressora. */
  progressPct: number;
  className?: string;
}

/**
 * Widget de filamento usado em tempo real. Busca o peso total
 * estimado (por filamento) do endpoint `layers.json` uma vez quando
 * o arquivo muda, e multiplica pelo progresso atual pra estimar
 * quantos gramas já foram consumidos.
 *
 * Estimativa não é perfeita (extrusão não é linearmente distribuída
 * pelo progresso), mas é próxima o suficiente pra dar noção.
 */
export function FilamentUsage({ printerId, cacheKey, progressPct, className }: Props) {
  const [meta, setMeta] = useState<Meta | null>(null);

  useEffect(() => {
    if (!cacheKey) {
      setMeta(null);
      return;
    }
    let alive = true;
    let attempt = 0;
    let timer: NodeJS.Timeout | null = null;

    const run = (): void => {
      fetch(
        `http://${LAN_HOST}:${LAN_PORT}/api/printers/${printerId}/layers.json?v=${encodeURIComponent(cacheKey ?? 'none')}`,
      )
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((d) => {
          if (!alive) return;
          const m = d.metadata;
          if (m && Array.isArray(m.filamentWeightG)) {
            setMeta({
              filamentWeightG: m.filamentWeightG,
              filamentLengthMm: m.filamentLengthMm ?? [],
            });
          }
        })
        .catch(() => {
          if (!alive) return;
          attempt++;
          timer = setTimeout(run, Math.min(3000 * 2 ** (attempt - 1), 30000));
        });
    };
    run();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [printerId, cacheKey]);

  if (!meta) {
    return null;
  }

  const totalG = meta.filamentWeightG.reduce((a, b) => a + b, 0);
  if (totalG <= 0) return null;

  const usedG = (totalG * Math.max(0, Math.min(100, progressPct))) / 100;
  const totalM =
    meta.filamentLengthMm.length > 0
      ? meta.filamentLengthMm.reduce((a, b) => a + b, 0) / 1000
      : null;

  return (
    <div
      className={cn(
        'rounded-md border border-border/60 bg-gradient-to-b from-muted/30 to-muted/10 px-2.5 py-1.5 flex flex-col gap-0.5',
        className,
      )}
    >
      <div className="flex items-center gap-1.5 text-[9px] font-mono uppercase tracking-wider text-muted-foreground">
        <Scale className="h-3 w-3" />
        Filamento
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-sm font-semibold tabular-nums">{usedG.toFixed(2)}g</span>
        <span className="text-[10px] text-muted-foreground">/ {totalG.toFixed(2)}g</span>
      </div>
      {totalM !== null ? (
        <div className="text-[10px] text-muted-foreground tabular-nums">
          {(totalM * (progressPct / 100)).toFixed(2)}m / {totalM.toFixed(2)}m
        </div>
      ) : null}
    </div>
  );
}
