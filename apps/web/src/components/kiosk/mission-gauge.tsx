'use client';

import { cn } from '@/lib/utils';

interface Props {
  /** Progresso 0-100. */
  value: number;
  /** Quantidade de segmentos (default 20). */
  segments?: number;
  className?: string;
}

/**
 * Gauge segmentado estilo HUD — substitui a progress bar tradicional
 * no kiosk Mission Mode. Cada segmento "lit" se o progresso passou
 * dele. Visual de barra de munição / energia.
 */
export function MissionGauge({ value, segments = 20, className }: Props) {
  const v = Math.max(0, Math.min(100, value));
  const litCount = Math.round((v / 100) * segments);
  return (
    <div data-mc-gauge className={cn('h-2.5', className)}>
      {Array.from({ length: segments }).map((_, i) => (
        <div
          key={i}
          data-mc-gauge-cell
          className={cn(i < litCount && 'lit')}
        />
      ))}
    </div>
  );
}
