'use client';

import { useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface AuditFiltersProps {
  knownActions: string[];
  knownTargetTypes: string[];
}

/**
 * Filtros do audit log (Story 9.9). Chips toggle pra action + targetType.
 * URL state via router.replace shareable.
 */
export function AuditFilters({ knownActions, knownTargetTypes }: AuditFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const actionActive = new Set(
    (searchParams.get('action') ?? '').split(',').filter(Boolean),
  );
  const typeActive = new Set(
    (searchParams.get('type') ?? '').split(',').filter(Boolean),
  );

  function applyParam(key: string, csv: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (csv) params.set(key, csv);
    else params.delete(key);
    params.delete('cursor');
    startTransition(() => {
      router.replace(`?${params.toString()}`, { scroll: false });
    });
  }

  function toggleInSet(key: string, active: Set<string>, value: string) {
    const next = new Set(active);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    applyParam(key, Array.from(next).join(','));
  }

  const hasAnyFilter = actionActive.size > 0 || typeActive.size > 0;

  if (knownActions.length === 0 && knownTargetTypes.length === 0) {
    return null; // No data → no filters
  }

  return (
    <div className="space-y-3 rounded-lg border border-[var(--mc-accent-soft)]/30 bg-card/40 p-4">
      <div className="flex flex-wrap items-center gap-3">
        {hasAnyFilter && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              startTransition(() => router.replace('?', { scroll: false }));
            }}
            disabled={pending}
            className="gap-1.5"
          >
            <X className="size-3" aria-hidden="true" />
            Limpar filtros
          </Button>
        )}
        {pending && (
          <span
            data-mc-id
            className="text-caption font-mono uppercase tracking-wider text-primary"
          >
            {'// LOADING…'}
          </span>
        )}
      </div>

      {knownActions.length > 0 && (
        <ChipGroup
          label="ACTION"
          values={knownActions}
          active={actionActive}
          onToggle={(v) => toggleInSet('action', actionActive, v)}
        />
      )}
      {knownTargetTypes.length > 0 && (
        <ChipGroup
          label="TARGET"
          values={knownTargetTypes}
          active={typeActive}
          onToggle={(v) => toggleInSet('type', typeActive, v)}
        />
      )}
    </div>
  );
}

function ChipGroup({
  label,
  values,
  active,
  onToggle,
}: {
  label: string;
  values: string[];
  active: Set<string>;
  onToggle: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
      <span
        data-mc-label
        className="shrink-0 pt-1 text-caption font-mono uppercase tracking-wider text-muted-foreground sm:w-20"
      >
        {label}
      </span>
      <div className="flex flex-wrap gap-1.5">
        {values.map((v) => {
          const isActive = active.has(v);
          return (
            <button
              key={v}
              type="button"
              onClick={() => onToggle(v)}
              aria-pressed={isActive}
              className={cn(
                'inline-flex items-center rounded-md border px-2 py-1 text-caption transition-colors',
                isActive
                  ? 'border-primary bg-primary/15 text-foreground'
                  : 'border-input bg-background text-muted-foreground hover:border-[var(--mc-accent-soft)]/60 hover:text-foreground',
              )}
            >
              <span className="font-mono">{v}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
