'use client';

import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Chip atômico — pill monospaced uppercase usado pra status secundários,
 * flags (SD, PORTA ABERTA), tags de estágio, etc. Padroniza os 5+
 * componentes de chip que estavam espalhados inline pelas pages.
 */

export type ChipTone = 'default' | 'muted' | 'success' | 'warning' | 'danger' | 'info' | 'primary';
export type ChipSize = 'sm' | 'md';

interface Props {
  children: React.ReactNode;
  icon?: LucideIcon;
  tone?: ChipTone;
  size?: ChipSize;
  className?: string;
}

const TONE: Record<ChipTone, string> = {
  default: 'border-border/60 bg-muted/40 text-muted-foreground',
  muted: 'border-border/40 bg-transparent text-muted-foreground',
  success: 'border-[hsl(var(--success)/0.45)] bg-[hsl(var(--success)/0.12)] text-[hsl(var(--success-foreground))]',
  warning: 'border-[hsl(var(--warning)/0.45)] bg-[hsl(var(--warning)/0.12)] text-[hsl(var(--warning-foreground))]',
  danger: 'border-[hsl(var(--danger)/0.5)] bg-[hsl(var(--danger)/0.12)] text-[hsl(var(--danger-foreground))]',
  info: 'border-[hsl(var(--info)/0.45)] bg-[hsl(var(--info)/0.12)] text-[hsl(var(--info-foreground))]',
  primary: 'border-primary/50 bg-primary/10 text-primary',
};

const SIZE: Record<ChipSize, string> = {
  sm: 'text-micro px-1.5 py-0.5 gap-1 h-5',
  md: 'text-caption px-2 py-0.5 gap-1.5 h-6',
};

export function Chip({ children, icon: Icon, tone = 'default', size = 'sm', className }: Props) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border font-mono uppercase tracking-wider whitespace-nowrap',
        TONE[tone],
        SIZE[size],
        className,
      )}
    >
      {Icon ? <Icon className={size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'} /> : null}
      {children}
    </span>
  );
}
