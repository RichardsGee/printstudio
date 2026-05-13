'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PaginationProps {
  nextCursor: string | null;
  hasMore: boolean;
  currentCount: number;
}

/**
 * Paginação cursor-based forward-only (Story 9.3).
 *
 * V1 sem "voltar página" — admin geralmente vai do mais recente em
 * diante. V1.1 pode adicionar histórico de cursors no URL.
 */
export function Pagination({ nextCursor, hasMore, currentCount }: PaginationProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function goNext() {
    if (!nextCursor) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set('cursor', nextCursor);
    router.replace(`?${params.toString()}`, { scroll: false });
  }

  function reset() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('cursor');
    router.replace(`?${params.toString()}`, { scroll: false });
  }

  const onFirstPage = !searchParams.get('cursor');

  return (
    <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
      <p className="text-caption text-muted-foreground">
        Exibindo <span data-mc-num>{currentCount}</span> lead
        {currentCount === 1 ? '' : 's'}
        {hasMore ? ' · há mais resultados' : ''}
      </p>
      <div className="flex gap-2">
        {!onFirstPage && (
          <Button type="button" variant="outline" size="sm" onClick={reset}>
            ← Voltar pro topo
          </Button>
        )}
        <Button
          type="button"
          size="sm"
          onClick={goNext}
          disabled={!hasMore}
          className="gap-1.5"
        >
          Próxima página
          <ChevronRight className="size-3" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
