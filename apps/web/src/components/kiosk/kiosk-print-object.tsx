'use client';

import { useEffect, useRef, useState } from 'react';
import { Box } from 'lucide-react';
import { cn } from '@/lib/utils';

const LAN_HOST = process.env.NEXT_PUBLIC_LAN_DISCOVERY_HOST ?? 'localhost';
const LAN_PORT = process.env.NEXT_PUBLIC_LAN_DISCOVERY_PORT ?? '8080';

interface Props {
  printerId: string;
  /** Nome do arquivo atual — usado como cache-key. */
  cacheKey?: string | null;
  /** Camada corrente. Define o ponto de "preenchimento" vertical. */
  currentLayer?: number | null;
  /** Total de camadas do job. */
  totalLayers?: number | null;
  /** Cor do filamento ativo (#rrggbb) — pinta a "linha de impressão". */
  filamentColor?: string | null;
  className?: string;
}

/**
 * Hero do KioskPrinterCard: mostra o objeto sendo impresso com
 * efeito de "preenchimento vertical" baseado na camada atual.
 *
 * Renderiza o thumbnail duas vezes:
 *   1. Camada "ghost" — opacity baixa, dessaturada, mostrando o
 *      que ainda falta imprimir (parte de cima);
 *   2. Camada "printed" — opacity total, mostrando o que já foi
 *      impresso (parte de baixo, do chão até a layer atual).
 *
 * O split point é animado com transição CSS pra dar sensação de
 * preenchimento progressivo. Uma linha fina na cor do filamento
 * marca o "print head" virtual.
 */
export function KioskPrintObject({
  printerId,
  cacheKey,
  currentLayer,
  totalLayers,
  filamentColor,
  className,
}: Props) {
  const [src, setSrc] = useState<string | null>(null);
  const [status, setStatus] = useState<'loading' | 'ok' | 'empty'>('loading');
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

      fetch(url)
        .then(async (r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          const blob = await r.blob();
          if (!alive) return;
          setSrc(URL.createObjectURL(blob));
          setStatus('ok');
        })
        .catch(() => {
          if (!alive) return;
          attempt++;
          if (attempt === 1) setStatus('empty');
          const delay = Math.min(2000 * Math.pow(2, attempt - 1), 30000);
          retryRef.current = setTimeout(tryFetch, delay);
        });
    };
    tryFetch();

    return () => {
      alive = false;
      if (retryRef.current) clearTimeout(retryRef.current);
    };
  }, [printerId, cacheKey]);

  // 0..1 — fração do print já feita (em camadas).
  const progress =
    currentLayer != null && totalLayers != null && totalLayers > 0
      ? Math.max(0, Math.min(1, currentLayer / totalLayers))
      : 0;

  // CSS split — calculado em %. printed cresce de baixo pra cima.
  const printedTop = (1 - progress) * 100;
  const ghostBottom = progress * 100;

  // Linha do "print head" — cor do filamento ativo, ou primary.
  const lineColor = filamentColor ?? 'hsl(var(--primary))';

  return (
    <div
      className={cn(
        'relative w-full h-full overflow-hidden rounded-xl border border-border/60 bg-gradient-to-b from-muted/20 to-background',
        className,
      )}
    >
      {status === 'ok' && src ? (
        <>
          {/* Ghost — parte ainda não impressa (top) */}
          <img
            src={src}
            alt=""
            aria-hidden
            draggable={false}
            className="absolute inset-0 h-full w-full object-contain p-4 transition-[clip-path] duration-1000 ease-out"
            style={{
              clipPath: `inset(0 0 ${ghostBottom}% 0)`,
              opacity: 0.22,
              filter: 'saturate(0.4) brightness(1.1)',
            }}
          />

          {/* Printed — parte já impressa (bottom), full color */}
          <img
            src={src}
            alt="Objeto sendo impresso"
            draggable={false}
            className="absolute inset-0 h-full w-full object-contain p-4 transition-[clip-path] duration-1000 ease-out"
            style={{ clipPath: `inset(${printedTop}% 0 0 0)` }}
          />

          {/* Print head line — sobe conforme as camadas avançam */}
          {progress > 0 && progress < 1 ? (
            <div
              className="absolute left-0 right-0 pointer-events-none transition-[bottom] duration-1000 ease-out"
              style={{ bottom: `${ghostBottom}%` }}
            >
              <div
                className="h-[2px] w-full"
                style={{
                  background: lineColor,
                  boxShadow: `0 0 12px ${lineColor}, 0 0 4px ${lineColor}`,
                }}
              />
            </div>
          ) : null}

          {/* Badge bottom-right com contagem de camadas */}
          {currentLayer != null && totalLayers != null ? (
            <div className="absolute bottom-2 right-2 rounded-md bg-background/80 backdrop-blur-sm border border-border/60 px-2 py-1 font-mono tabular-nums text-foreground">
              <span style={{ fontSize: 'clamp(0.625rem, 1vw, 0.875rem)' }}>
                {currentLayer}<span className="text-muted-foreground"> / {totalLayers}</span>
              </span>
            </div>
          ) : null}
        </>
      ) : (
        <div className="absolute inset-0 grid place-items-center text-muted-foreground">
          <div className="flex flex-col items-center gap-2">
            <Box
              strokeWidth={1.2}
              style={{ width: 'clamp(2rem, 4vw, 3.5rem)', height: 'clamp(2rem, 4vw, 3.5rem)' }}
            />
            <span style={{ fontSize: 'clamp(0.75rem, 1.1vw, 0.9375rem)' }}>
              {status === 'loading' ? 'Carregando objeto…' : 'Aguardando preview…'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
