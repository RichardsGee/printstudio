'use client';

import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Atomic metric: label monospaced-uppercase + value tabular-nums.
 * Substitui StatRow, InfoPill e StatCell com uma única API.
 *
 *   layout="row"    → label à esquerda, valor à direita (mesmo rol)
 *   layout="stack"  → label em cima, valor embaixo (pílula/célula)
 *   layout="card"   → stack + border + bg + padding (self-contained)
 */

export type MetricTone = 'default' | 'muted' | 'success' | 'warning' | 'danger' | 'info' | 'primary';
export type MetricLayout = 'row' | 'stack' | 'card';
export type MetricSize = 'sm' | 'md' | 'lg';

interface Props {
  label: string;
  value: React.ReactNode;
  icon?: LucideIcon;
  tone?: MetricTone;
  layout?: MetricLayout;
  size?: MetricSize;
  /** Info secundária abaixo do valor (só em stack/card). */
  sub?: React.ReactNode;
  className?: string;
}

const TONE_TEXT: Record<MetricTone, string> = {
  default: 'text-foreground',
  muted: 'text-muted-foreground',
  success: 'tone-success',
  warning: 'tone-warning',
  danger: 'tone-danger',
  info: 'tone-info',
  primary: 'text-primary',
};

const VALUE_SIZE: Record<MetricSize, string> = {
  sm: 'text-small',
  md: 'text-body',
  lg: 'text-body-lg',
};

export function Metric({
  label,
  value,
  icon: Icon,
  tone = 'default',
  layout = 'stack',
  size = 'md',
  sub,
  className,
}: Props) {
  if (layout === 'row') {
    return (
      <div className={cn('flex items-center gap-2 text-small', className)}>
        {Icon ? <Icon className={cn('h-3.5 w-3.5 shrink-0', TONE_TEXT[tone])} /> : null}
        <span className="text-muted-foreground">{label}</span>
        <span className={cn('ml-auto font-medium tabular-nums', TONE_TEXT[tone])}>
          {value}
        </span>
      </div>
    );
  }

  const content = (
    <>
      <div className="flex items-center gap-1 text-micro font-mono uppercase tracking-wider text-muted-foreground">
        {Icon ? <Icon className="h-3 w-3" /> : null}
        {label}
      </div>
      <div className={cn('font-semibold tabular-nums leading-tight', VALUE_SIZE[size], TONE_TEXT[tone])}>
        {value}
      </div>
      {sub ? (
        <div className="text-caption text-muted-foreground tabular-nums">{sub}</div>
      ) : null}
    </>
  );

  if (layout === 'card') {
    return (
      <div
        className={cn(
          'rounded-md border border-border/60 bg-gradient-to-b from-muted/25 to-muted/5 px-2.5 py-1.5 flex flex-col gap-0.5',
          className,
        )}
      >
        {content}
      </div>
    );
  }

  // stack (sem chrome)
  return (
    <div className={cn('flex flex-col gap-0.5', className)}>
      {content}
    </div>
  );
}
