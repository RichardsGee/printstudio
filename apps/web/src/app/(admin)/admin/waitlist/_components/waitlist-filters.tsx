'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface WaitlistFiltersProps {
  statusValues: readonly string[];
  roleValues: readonly string[];
  stateValues: readonly string[];
  statusCounts: Record<string, number>;
}

const ROLE_LABELS: Record<string, string> = {
  hobbyist: 'Hobby',
  small_shop: 'Print shop',
  studio: 'Estúdio',
  business: 'Empresa',
  other: 'Outro',
};

const STATUS_LABELS: Record<string, string> = {
  new: 'New',
  contacted: 'Contactado',
  engaged: 'Engaged',
  invited: 'Invited',
  converted: 'Convertido',
  lost: 'Lost',
};

/**
 * Filtros da listagem waitlist (Story 9.3).
 *
 * URL state: cada filter aplica query params via `router.replace()`.
 * Server re-renderiza a página com novos resultados.
 *
 * Multi-select: chips clicáveis (toggle). Busca: input debounced 300ms.
 */
export function WaitlistFilters({
  statusValues,
  roleValues,
  stateValues,
  statusCounts,
}: WaitlistFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState(() => searchParams.get('q') ?? '');

  const statusActive = new Set(
    (searchParams.get('status') ?? '').split(',').filter(Boolean),
  );
  const roleActive = new Set(
    (searchParams.get('role') ?? '').split(',').filter(Boolean),
  );
  const stateActive = new Set(
    (searchParams.get('state') ?? '').split(',').filter(Boolean),
  );

  function applyParam(key: string, csv: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (csv) params.set(key, csv);
    else params.delete(key);
    params.delete('cursor'); // reset paginação ao mudar filtro
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

  function clearAll() {
    setQuery('');
    startTransition(() => {
      router.replace(`?`, { scroll: false });
    });
  }

  // Busca debounced (300ms)
  useEffect(() => {
    const handle = setTimeout(() => {
      const current = searchParams.get('q') ?? '';
      if (query.trim() === current) return;
      applyParam('q', query.trim());
    }, 300);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const hasAnyFilter =
    statusActive.size > 0 ||
    roleActive.size > 0 ||
    stateActive.size > 0 ||
    (searchParams.get('q') ?? '').length > 0;

  return (
    <div className="space-y-3 rounded-lg border border-[var(--mc-accent-soft)]/30 bg-card/40 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          type="search"
          placeholder="Buscar por nome ou email…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="sm:max-w-sm"
        />
        {hasAnyFilter && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={clearAll}
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

      <FilterChipGroup
        label="STATUS"
        values={statusValues}
        active={statusActive}
        labels={STATUS_LABELS}
        counts={statusCounts}
        onToggle={(v) => toggleInSet('status', statusActive, v)}
      />
      <FilterChipGroup
        label="USO"
        values={roleValues}
        active={roleActive}
        labels={ROLE_LABELS}
        onToggle={(v) => toggleInSet('role', roleActive, v)}
      />
      <FilterChipGroup
        label="UF"
        values={stateValues}
        active={stateActive}
        onToggle={(v) => toggleInSet('state', stateActive, v)}
      />
    </div>
  );
}

interface FilterChipGroupProps {
  label: string;
  values: readonly string[];
  active: Set<string>;
  labels?: Record<string, string>;
  counts?: Record<string, number>;
  onToggle: (value: string) => void;
}

function FilterChipGroup({
  label,
  values,
  active,
  labels,
  counts,
  onToggle,
}: FilterChipGroupProps) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
      <span
        data-mc-label
        className="shrink-0 pt-1 text-caption font-mono uppercase tracking-wider text-muted-foreground sm:w-16"
      >
        {label}
      </span>
      <div className="flex flex-wrap gap-1.5">
        {values.map((v) => {
          const isActive = active.has(v);
          const display = labels?.[v] ?? v;
          const count = counts?.[v];
          return (
            <button
              key={v}
              type="button"
              onClick={() => onToggle(v)}
              aria-pressed={isActive}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-caption transition-colors',
                isActive
                  ? 'border-primary bg-primary/15 text-foreground'
                  : 'border-input bg-background text-muted-foreground hover:border-[var(--mc-accent-soft)]/60 hover:text-foreground',
              )}
            >
              <span className="uppercase tracking-wider">{display}</span>
              {count !== undefined && count > 0 && (
                <span data-mc-num className="font-mono text-muted-foreground">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
