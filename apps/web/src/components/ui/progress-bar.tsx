'use client';

import { cn } from '@/lib/utils';

/**
 * Progress bar padronizada — uma API única substitui 3 implementações
 * inline de barra de progresso com cores e alturas diferentes.
 *
 *   accent: primary (azul) | success (verde) | warning (âmbar) | danger
 *   size: xs (1px) | sm (1.5px) | md (2px) | lg (4px)
 */

type ProgressAccent = 'primary' | 'success' | 'warning' | 'danger' | 'info';
type ProgressSize = 'xs' | 'sm' | 'md' | 'lg';

interface Props {
  value: number;
  max?: number;
  accent?: ProgressAccent;
  size?: ProgressSize;
  label?: string;
  primary?: string;
  className?: string;
  /** Animação contínua (pulse diagonal) — usado quando o valor não muda mas algo está acontecendo. */
  indeterminate?: boolean;
}

const ACCENT: Record<ProgressAccent, string> = {
  primary: 'bg-gradient-to-r from-primary/80 to-primary',
  success: 'bg-gradient-to-r from-[hsl(var(--success)/0.7)] to-[hsl(var(--success))]',
  warning: 'bg-gradient-to-r from-[hsl(var(--warning)/0.7)] to-[hsl(var(--warning))]',
  danger: 'bg-gradient-to-r from-[hsl(var(--danger)/0.7)] to-[hsl(var(--danger))]',
  info: 'bg-gradient-to-r from-[hsl(var(--info)/0.7)] to-[hsl(var(--info))]',
};

const HEIGHT: Record<ProgressSize, string> = {
  xs: 'h-1',
  sm: 'h-1.5',
  md: 'h-2',
  lg: 'h-3',
};

export function ProgressBar({
  value,
  max = 100,
  accent = 'primary',
  size = 'sm',
  label,
  primary,
  className,
  indeterminate = false,
}: Props) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className={cn('w-full', className)}>
      {label || primary ? (
        <div className="flex items-baseline justify-between mb-1">
          {label ? (
            <span className="text-micro font-mono uppercase tracking-wider text-muted-foreground">
              {label}
            </span>
          ) : null}
          {primary ? (
            <span className="text-body font-semibold tabular-nums">{primary}</span>
          ) : null}
        </div>
      ) : null}
      <div className={cn('w-full rounded-full bg-muted/60 overflow-hidden', HEIGHT[size])}>
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500 ease-out',
            ACCENT[accent],
            indeterminate && 'animate-pulse',
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
