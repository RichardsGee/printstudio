'use client';

import { useEffect, useRef, useState } from 'react';
import { Box } from 'lucide-react';
import { cn } from '@/lib/utils';

const LAN_HOST = process.env.NEXT_PUBLIC_LAN_DISCOVERY_HOST ?? 'localhost';
const LAN_PORT = process.env.NEXT_PUBLIC_LAN_DISCOVERY_PORT ?? '8080';

interface Props {
  printerId: string;
  /** Nome do arquivo atual — o bridge só retorna o thumbnail se bater. */
  cacheKey?: string | null;
  className?: string;
}

/**
 * Thumbnail extraído do `.3mf` atual via FTPS. O bridge valida que o
 * cache bate com o arquivo pedido — se não bater (transição entre
 * jobs), retorna 404 e a UI fica em "loading" até o novo fetch
 * completar, em vez de mostrar o thumbnail do job anterior.
 */
export function ThumbnailPreview({ printerId, cacheKey, className }: Props) {
  const [status, setStatus] = useState<'loading' | 'ok' | 'empty'>('loading');
  const [src, setSrc] = useState<string | null>(null);
  const retryRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    let alive = true;
    let attempt = 0;
    setStatus('loading');
    setSrc(null);

    const tryFetch = (): void => {
      const fileParam = cacheKey ? `&file=${encodeURIComponent(cacheKey)}` : '';
      const url = `http://${LAN_HOST}:${LAN_PORT}/api/printers/${printerId}/thumbnail.png?v=${encodeURIComponent(
        cacheKey ?? 'none',
      )}${fileParam}`;

      // Tenta baixar via fetch pra poder distinguir 404 de imagem carregada
      fetch(url)
        .then(async (r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          const blob = await r.blob();
          if (!alive) return;
          const objectUrl = URL.createObjectURL(blob);
          setSrc(objectUrl);
          setStatus('ok');
        })
        .catch(() => {
          if (!alive) return;
          attempt++;
          // Backoff: 2, 4, 8, 16s; teto 30s. Bridge pode levar esse tempo
          // pra fazer o FTPS download do .3mf novo.
          const delay = Math.min(2000 * Math.pow(2, attempt - 1), 30000);
          if (attempt === 1) setStatus('empty');
          retryRef.current = setTimeout(tryFetch, delay);
        });
    };
    tryFetch();

    return () => {
      alive = false;
      if (retryRef.current) clearTimeout(retryRef.current);
    };
  }, [printerId, cacheKey]);

  return (
    <div
      className={cn(
        'relative aspect-square w-full overflow-hidden rounded-md border border-border/60 bg-muted/30',
        className,
      )}
    >
      {status === 'ok' && src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt="Preview do modelo"
          className="h-full w-full object-contain"
        />
      ) : (
        <div className="absolute inset-0 grid place-items-center text-muted-foreground">
          <div className="flex flex-col items-center gap-1 text-xs">
            <Box className="h-6 w-6" strokeWidth={1.5} />
            <span>
              {status === 'loading'
                ? 'Carregando preview…'
                : 'Aguardando preview do trabalho atual…'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
