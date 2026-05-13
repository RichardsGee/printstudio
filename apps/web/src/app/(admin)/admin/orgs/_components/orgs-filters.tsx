'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { PLAN_KEYS } from '@printstudio/shared';
import { cn } from '@/lib/utils';

interface OrgsFiltersProps {
  planCounts: Record<string, number>;
}

const PLAN_LABELS: Record<string, string> = {
  free: 'Free',
  pro: 'Pro',
  business: 'Business',
};

/**
 * Filtros da listagem `/admin/orgs` (Story 9.5).
 *
 * Same pattern do waitlist: busca debounced 300ms + chip toggle
 * multi-select. URL state shareable via router.replace.
 */
export function OrgsFilters({ planCounts }: OrgsFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState(() => searchParams.get('q') ?? '');

  const planActive = new Set(
    (searchParams.get('plan') ?? '').split(',').filter(Boolean),
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

  function togglePlan(plan: string) {
    const next = new Set(planActive);
    if (next.has(plan)) next.delete(plan);
    else next.add(plan);
    applyParam('plan', Array.from(next).join(','));
  }

  function clearAll() {
    setQuery('');
    startTransition(() => {
      router.replace(`?`, { scroll: false });
    });
  }

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
    planActive.size > 0 || (searchParams.get('q') ?? '').length > 0;

  return (
    <div className="space-y-3 rounded-lg border border-[var(--mc-accent-soft)]/30 bg-card/40 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          type="search"
          placeholder="Buscar por nome da org ou email do owner…"
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

      <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
        <span
          data-mc-label
          className="shrink-0 pt-1 text-caption font-mono uppercase tracking-wider text-muted-foreground sm:w-16"
        >
          PLANO
        </span>
        <div className="flex flex-wrap gap-1.5">
          {PLAN_KEYS.map((p) => {
            const isActive = planActive.has(p);
            const count = planCounts[p] ?? 0;
            return (
              <button
                key={p}
                type="button"
                onClick={() => togglePlan(p)}
                aria-pressed={isActive}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-caption transition-colors',
                  isActive
                    ? 'border-primary bg-primary/15 text-foreground'
                    : 'border-input bg-background text-muted-foreground hover:border-[var(--mc-accent-soft)]/60 hover:text-foreground',
                )}
              >
                <span className="uppercase tracking-wider">
                  {PLAN_LABELS[p] ?? p}
                </span>
                {count > 0 && (
                  <span data-mc-num className="font-mono text-muted-foreground">
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
