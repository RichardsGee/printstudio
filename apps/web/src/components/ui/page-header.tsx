'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  /** Station/system identifier shown as `// ID` prefix (monospace, accent) */
  id?: string;
  title: string;
  description?: string;
  /** Show live clock in YYYY-MM-DD HH:MM format. Defaults to true. */
  showTimestamp?: boolean;
  /** Right-side custom actions (buttons, badges, etc.) — replaces timestamp if provided */
  actions?: React.ReactNode;
  className?: string;
}

function formatTimestamp(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

function useNow(enabled: boolean): Date | null {
  // Inicia null no SSR pra evitar hydration mismatch — só o client popula.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    if (!enabled) return;
    setNow(new Date());
    const interval = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(interval);
  }, [enabled]);
  return now;
}

/**
 * Header padrão de páginas internas — estilo Mission Control telemetria.
 *
 *   // STATION-ID    TITLE        2026-05-11 14:32
 *      Description text below
 *
 * - `id` opcional vira prefixo `// ID` em monospace cyan
 * - timestamp atualiza a cada 60s no client (default ligado)
 * - `actions` substitui timestamp pra ações custom (botões etc)
 */
export function PageHeader({
  id,
  title,
  description,
  showTimestamp = true,
  actions,
  className,
}: PageHeaderProps) {
  const now = useNow(showTimestamp && !actions);

  return (
    <header className={cn('space-y-1.5', className)}>
      <div className="flex items-baseline gap-3 flex-wrap">
        {id ? (
          <span
            data-mc-id
            className="text-caption uppercase tracking-wider text-primary shrink-0"
          >
            {`// ${id}`}
          </span>
        ) : null}
        <h1 className="text-heading uppercase tracking-wider">{title}</h1>
        {actions ? (
          <div className="ml-auto flex items-center gap-2">{actions}</div>
        ) : now ? (
          <span
            data-mc-num
            className="ml-auto text-caption text-muted-foreground tabular-nums"
            suppressHydrationWarning
          >
            {formatTimestamp(now)}
          </span>
        ) : null}
      </div>
      {description ? (
        <p className="text-small text-muted-foreground">{description}</p>
      ) : null}
    </header>
  );
}
