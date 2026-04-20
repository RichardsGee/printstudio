'use client';

import { Fan } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  part: number | null;
  aux: number | null;
  chamber: number | null;
  className?: string;
}

export function FansDisplay({ part, aux, chamber, className }: Props) {
  return (
    <div className={cn('grid grid-cols-3 gap-2 text-xs', className)}>
      <FanItem label="Peça" percent={part} />
      <FanItem label="Auxiliar" percent={aux} />
      <FanItem label="Câmara" percent={chamber} />
    </div>
  );
}

function FanItem({ label, percent }: { label: string; percent: number | null }) {
  const spin = percent !== null && percent > 0;
  const spinClass =
    percent === null ? '' : percent >= 70 ? 'animate-[spin_0.35s_linear_infinite]' : percent >= 30 ? 'animate-[spin_0.8s_linear_infinite]' : percent > 0 ? 'animate-[spin_1.6s_linear_infinite]' : '';
  return (
    <div className="flex flex-col items-center gap-1 rounded-md border border-border/60 p-2">
      <Fan className={cn('h-5 w-5 text-muted-foreground', spin && spinClass)} />
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{percent === null ? '—' : `${percent}%`}</span>
    </div>
  );
}
