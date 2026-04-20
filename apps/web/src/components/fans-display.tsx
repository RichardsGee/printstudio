'use client';

import { Fan } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  part: number | null;
  aux: number | null;
  chamber: number | null;
  heatbreak?: number | null;
  className?: string;
}

export function FansDisplay({ part, aux, chamber, heatbreak, className }: Props) {
  const cols = heatbreak !== null && heatbreak !== undefined ? 'grid-cols-4' : 'grid-cols-3';
  return (
    <div className={cn('grid gap-2 text-xs', cols, className)}>
      <FanItem label="Peça" percent={part} />
      <FanItem label="Auxiliar" percent={aux} />
      <FanItem label="Câmara" percent={chamber} />
      {heatbreak !== null && heatbreak !== undefined ? (
        <FanItem label="Heatbreak" percent={heatbreak} />
      ) : null}
    </div>
  );
}

/**
 * Cor e velocidade do ícone escalam com o RPM:
 *   parado   → cinza
 *   baixo    → azul suave (slow spin)
 *   médio    → ciano     (spin médio)
 *   alto     → amber     (fast spin)
 *   máximo   → vermelho  (spin muito rápido)
 * Borda do card acompanha pra dar feedback à distância.
 */
function FanItem({ label, percent }: { label: string; percent: number | null }) {
  const tier =
    percent === null || percent === 0
      ? 'idle'
      : percent < 30
        ? 'low'
        : percent < 70
          ? 'mid'
          : percent < 95
            ? 'high'
            : 'max';

  const spinClass = {
    idle: '',
    low: 'animate-[spin_1.6s_linear_infinite]',
    mid: 'animate-[spin_0.8s_linear_infinite]',
    high: 'animate-[spin_0.4s_linear_infinite]',
    max: 'animate-[spin_0.25s_linear_infinite]',
  }[tier];

  const iconColor = {
    idle: 'text-muted-foreground/60',
    low: 'text-sky-400',
    mid: 'text-cyan-300',
    high: 'text-amber-400',
    max: 'text-red-400',
  }[tier];

  const borderColor = {
    idle: 'border-border/60',
    low: 'border-sky-500/40',
    mid: 'border-cyan-400/50',
    high: 'border-amber-500/50',
    max: 'border-red-500/60',
  }[tier];

  const bgGlow = {
    idle: '',
    low: 'bg-sky-500/5',
    mid: 'bg-cyan-400/5',
    high: 'bg-amber-500/5',
    max: 'bg-red-500/10',
  }[tier];

  return (
    <div
      className={cn(
        'flex flex-col items-center gap-1 rounded-md border p-2 transition-colors',
        borderColor,
        bgGlow,
      )}
    >
      <Fan className={cn('h-5 w-5 transition-colors', iconColor, spinClass)} />
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <span className={cn('font-medium tabular-nums', tier !== 'idle' ? iconColor : '')}>
        {percent === null ? '—' : `${percent}%`}
      </span>
    </div>
  );
}
