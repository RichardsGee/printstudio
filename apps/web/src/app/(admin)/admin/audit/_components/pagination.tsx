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
 * Pagination forward-only do audit log. Mesma pattern de Stories 9.3 e 9.5.
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
        Exibindo <span data-mc-num>{currentCount}</span> entr
        {currentCount === 1 ? 'y' : 'ies'}
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
