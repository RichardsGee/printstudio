'use client';

import { useEffect, useState } from 'react';
import { Box } from 'lucide-react';
import { cn } from '@/lib/utils';

const LAN_HOST = process.env.NEXT_PUBLIC_LAN_DISCOVERY_HOST ?? 'localhost';
const LAN_PORT = process.env.NEXT_PUBLIC_LAN_DISCOVERY_PORT ?? '8080';

interface Props {
  printerId: string;
  /** Changes whenever the print file changes — busts the browser image cache */
  cacheKey?: string | null;
  className?: string;
}

/**
 * Thumbnail extracted from the `.3mf` of the currently printing job.
 * Falls back to a placeholder while the bridge hasn't downloaded the
 * thumbnail yet, or if there's no active job.
 */
export function ThumbnailPreview({ printerId, cacheKey, className }: Props) {
  const [status, setStatus] = useState<'loading' | 'ok' | 'empty'>('loading');

  useEffect(() => {
    setStatus('loading');
  }, [printerId, cacheKey]);

  const src = `http://${LAN_HOST}:${LAN_PORT}/api/printers/${printerId}/thumbnail.png?v=${encodeURIComponent(
    cacheKey ?? 'none',
  )}`;

  return (
    <div
      className={cn(
        'relative aspect-square w-full overflow-hidden rounded-md border border-border/60 bg-muted/30',
        className,
      )}
    >
      {status !== 'empty' ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt="Preview do modelo"
          onLoad={() => setStatus('ok')}
          onError={() => setStatus('empty')}
          className={cn(
            'h-full w-full object-contain transition-opacity',
            status === 'loading' ? 'opacity-0' : 'opacity-100',
          )}
        />
      ) : null}
      {status !== 'ok' ? (
        <div className="absolute inset-0 grid place-items-center text-muted-foreground">
          <div className="flex flex-col items-center gap-1 text-xs">
            <Box className="h-6 w-6" strokeWidth={1.5} />
            <span>{status === 'loading' ? 'Carregando preview…' : 'Sem preview'}</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
