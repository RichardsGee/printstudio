'use client';

import { Gauge, Leaf, Zap, Flame, Rocket } from 'lucide-react';
import type { SpeedMode } from '@printstudio/shared';
import { cn } from '@/lib/utils';

const CONFIG: Record<SpeedMode, { label: string; icon: typeof Gauge; classes: string }> = {
  silent: { label: 'Silencioso', icon: Leaf, classes: 'text-sky-400' },
  standard: { label: 'Padrão', icon: Gauge, classes: 'text-foreground' },
  sport: { label: 'Esporte', icon: Zap, classes: 'text-amber-400' },
  ludicrous: { label: 'Extremo', icon: Rocket, classes: 'text-red-400' },
};

interface Props {
  mode: SpeedMode | null;
  percent?: number | null;
  className?: string;
}

export function SpeedModeIndicator({ mode, percent, className }: Props) {
  if (!mode) {
    return (
      <div className={cn('inline-flex items-center gap-1.5 text-muted-foreground text-xs', className)}>
        <Flame className="h-3.5 w-3.5" />
        <span>—</span>
      </div>
    );
  }
  const cfg = CONFIG[mode];
  const Icon = cfg.icon;
  return (
    <div className={cn('inline-flex items-center gap-1.5 text-xs', cfg.classes, className)}>
      <Icon className="h-3.5 w-3.5" />
      <span className="font-medium">{cfg.label}</span>
      {typeof percent === 'number' ? (
        <span className="text-muted-foreground">{Math.round(percent)}%</span>
      ) : null}
    </div>
  );
}
