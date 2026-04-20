'use client';

import { Wifi, WifiOff, WifiLow, WifiHigh, WifiZero } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  dbm: number | null;
  showDbm?: boolean;
  className?: string;
}

export function WifiIndicator({ dbm, showDbm = true, className }: Props) {
  if (dbm === null) {
    return (
      <div className={cn('inline-flex items-center gap-1 text-xs text-muted-foreground', className)}>
        <WifiOff className="h-3.5 w-3.5" />
      </div>
    );
  }
  const { Icon, tone, label } = classify(dbm);
  return (
    <div className={cn('inline-flex items-center gap-1 text-xs', tone, className)}>
      <Icon className="h-3.5 w-3.5" />
      {showDbm ? <span className="tabular-nums">{dbm} dBm</span> : null}
      {!showDbm ? <span>{label}</span> : null}
    </div>
  );
}

function classify(dbm: number) {
  if (dbm >= -50) return { Icon: Wifi, tone: 'text-emerald-400', label: 'Excelente' };
  if (dbm >= -60) return { Icon: WifiHigh, tone: 'text-emerald-400', label: 'Bom' };
  if (dbm >= -70) return { Icon: WifiLow, tone: 'text-amber-400', label: 'Ok' };
  return { Icon: WifiZero, tone: 'text-red-400', label: 'Fraco' };
}
