'use client';

import { Fan } from 'lucide-react';
import { cn } from '@/lib/utils';

/** `undefined` = o modelo não tem essa ventoinha (não renderiza); `null` = sem leitura. */
interface Props {
  part: number | null;
  aux?: number | null;
  chamber?: number | null;
  heatbreak?: number | null;
  className?: string;
}

const COLS = ['grid-cols-1', 'grid-cols-1', 'grid-cols-2', 'grid-cols-3', 'grid-cols-4'];

export function FansDisplay({ part, aux, chamber, heatbreak, className }: Props) {
  const fans: { label: string; percent: number | null }[] = [{ label: 'Peça', percent: part }];
  if (aux !== undefined) fans.push({ label: 'Auxiliar', percent: aux });
  if (chamber !== undefined) fans.push({ label: 'Câmara', percent: chamber });
  if (heatbreak !== null && heatbreak !== undefined) {
    fans.push({ label: 'Heatbreak', percent: heatbreak });
  }
  return (
    <div className={cn('grid gap-2 text-xs', COLS[fans.length], className)}>
      {fans.map((f) => (
        <FanItem key={f.label} label={f.label} percent={f.percent} />
      ))}
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
