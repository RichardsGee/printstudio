'use client';

import { Circle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  /** Bambu hex with alpha, e.g. "FFFFFFFF" */
  color: string | null;
  /** If true, shows active ring */
  active?: boolean;
  /** Tailwind size class; default is 'h-6 w-6' */
  size?: 'sm' | 'md' | 'lg';
  label?: string | null;
}

const SIZE_CLASSES: Record<NonNullable<Props['size']>, string> = {
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-10 w-10',
};

export function FilamentSwatch({ color, active = false, size = 'md', label }: Props) {
  const hex = normalizeHex(color);
  const cls = SIZE_CLASSES[size];

  return (
    <div className="inline-flex items-center gap-2">
      <div
        className={cn(
          'rounded-full shrink-0 ring-1 ring-border shadow-inner',
          cls,
          active && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
        )}
        style={{ backgroundColor: hex ?? 'transparent' }}
        title={hex ?? 'sem filamento'}
      >
        {!hex ? <Circle className={cn('text-muted-foreground', cls)} strokeWidth={1} /> : null}
      </div>
      {label ? <span className="text-xs text-muted-foreground">{label}</span> : null}
    </div>
  );
}

/** "FFFFFFFF" → "#FFFFFFFF" (CSS accepts 8-digit hex). Returns null if unparseable. */
function normalizeHex(color: string | null): string | null {
  if (!color) return null;
  const m = color.match(/^#?([0-9a-fA-F]{6,8})$/);
  if (!m) return null;
  return `#${m[1]}`;
}
