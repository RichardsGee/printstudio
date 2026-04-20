'use client';

import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  /** Tone: neutral (default), muted, warn, danger, ok */
  tone?: 'neutral' | 'muted' | 'warn' | 'danger' | 'ok';
  className?: string;
}

const TONE_CLASSES: Record<NonNullable<Props['tone']>, string> = {
  neutral: 'text-foreground',
  muted: 'text-muted-foreground',
  warn: 'text-amber-500',
  danger: 'text-red-500',
  ok: 'text-emerald-500',
};

export function StatRow({ icon: Icon, label, value, tone = 'neutral', className }: Props) {
  return (
    <div className={cn('flex items-center gap-2 text-sm', className)}>
      <Icon className={cn('h-4 w-4 shrink-0', TONE_CLASSES[tone])} />
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className={cn('ml-auto font-medium tabular-nums', TONE_CLASSES[tone])}>{value}</span>
    </div>
  );
}
