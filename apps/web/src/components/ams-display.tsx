import type { AmsSlot } from '@printstudio/shared';
import { Spool } from './spool';
import { cn } from '@/lib/utils';

/**
 * Compact AMS view — 4 slots rendered as spool + stats side-by-side, all
 * in a single row so they fill whatever width the parent gives us.
 */
export function AmsDisplay({ slots }: { slots: AmsSlot[] }) {
  const normalized: (AmsSlot | null)[] = [0, 1, 2, 3].map(
    (i) => slots.find((s) => s.slot === i) ?? null,
  );

  return (
    <div className="rounded-xl border border-border/60 bg-card p-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {normalized.map((slot, i) => (
          <SlotCell key={i} slot={slot} index={i} />
        ))}
      </div>
    </div>
  );
}

function SlotCell({ slot, index }: { slot: AmsSlot | null; index: number }) {
  const active = !!slot?.active;
  const pct = slot?.remainingPct ?? null;
  const color = normalizeHex(slot?.color);

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-lg border px-2 py-1.5',
        active ? 'border-primary/60 bg-primary/5' : 'border-border/40',
      )}
    >
      <Spool
        color={slot?.color ?? null}
        active={active}
        rotating={active}
        size={84}
      />
      <div className="min-w-0 flex-1 flex flex-col gap-0.5">
        <div className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground">
          <span>SLOT {index + 1}</span>
          {active ? <span className="text-primary">• ativo</span> : null}
        </div>
        <div className="flex items-center gap-1.5">
          <div
            className={cn(
              'h-3 w-3 rounded-full shrink-0 ring-1 ring-border',
              !color && 'bg-muted/40',
            )}
            style={color ? { backgroundColor: color } : undefined}
          />
          <span className="text-xs truncate">
            {slot?.filamentType ?? '—'}
          </span>
        </div>
        {pct !== null ? (
          <div className="flex items-center gap-1.5">
            <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
              <div
                className={cn('h-full', active ? 'bg-primary' : 'bg-foreground/60')}
                style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
              />
            </div>
            <span className="text-[10px] font-mono tabular-nums text-muted-foreground">
              {Math.round(pct)}%
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function normalizeHex(color: string | null | undefined): string | null {
  if (!color) return null;
  const m = color.match(/^#?([0-9a-fA-F]{6,8})$/);
  if (!m) return null;
  return `#${m[1]}`;
}
