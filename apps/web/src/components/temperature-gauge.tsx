import { cn } from '@/lib/utils';

interface Props {
  label: string;
  current: number | null;
  target: number | null;
  className?: string;
}

export function TemperatureGauge({ label, current, target, className }: Props) {
  const value = current == null ? '—' : `${current.toFixed(1)}°C`;
  const targetValue = target == null ? '—' : `${target.toFixed(0)}°C`;
  const heating = current != null && target != null && target - current > 2;

  return (
    <div className={cn('flex flex-col gap-0.5 text-sm', className)}>
      <span className="text-muted-foreground text-xs">{label}</span>
      <span
        className={cn(
          'font-mono font-semibold',
          heating && 'text-amber-400',
        )}
      >
        {value}
        <span className="text-muted-foreground font-normal"> / {targetValue}</span>
      </span>
    </div>
  );
}
