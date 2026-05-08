'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

/** Normaliza hex que pode vir com alpha (`6BC872FF`) ou sem `#`. */
function normalizeHex(c: string | null | undefined): string {
  if (!c) return '#3b82f6';
  const m = c.match(/^#?([0-9a-fA-F]{6,8})$/);
  return m ? `#${m[1].slice(0, 6)}` : '#3b82f6';
}

interface Props {
  /** Quando false (pausada/ociosa/etc), pulsação congela em flatline. */
  active?: boolean;
  /** Cor do traço — geralmente cor do filamento. */
  color?: string;
  /** Velocidade % — modula frequência das ondas. */
  speedPercent?: number | null;
  /** Camada atual / total — usado pra altura Z indicativa. */
  currentLayer?: number | null;
  totalLayers?: number | null;
  /** Altura total estimada do print em mm (do .3mf). Quando passada,
   *  exibe Z atual em mm. Senão mostra %. */
  meshHeightMm?: number | null;
  className?: string;
}

/**
 * Oscilador de "movimento" estilo monitor de sinais vitais. Mistura
 * 3 harmônicas + ruído sutil pra ter cara orgânica (não tão regular
 * quanto um seno puro). Frequência cresce com speedPercent.
 *
 * Renderizado em canvas via RAF — leve mesmo com várias instâncias
 * (cada card tem uma). Pausa o RAF quando active=false.
 */
export function MotionPulse({
  active,
  color,
  speedPercent,
  currentLayer,
  totalLayers,
  meshHeightMm,
  className,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<{ raf: number | null; t: number }>({ raf: null, t: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let disposed = false;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    function resize(): void {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    // Frequência base: 100% speed → 1 ciclo a cada ~80px. Escala com speed.
    const speed = (speedPercent ?? 100) / 100; // 0.5..2

    const tick = (): void => {
      if (disposed) return;
      const w = canvas.width;
      const h = canvas.height;
      const cy = h / 2;
      const ampPx = h * 0.32;

      ctx.clearRect(0, 0, w, h);
      ctx.lineWidth = Math.max(1, 1.6 * dpr);
      ctx.strokeStyle = normalizeHex(color);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      ctx.beginPath();
      const t = animRef.current.t;
      // Wave = sin principal + harmônicas + ruído pseudo. Fica mais
      // "vivo" que um seno puro.
      for (let x = 0; x <= w; x++) {
        const phase = (x + t) * 0.04 * speed;
        const y =
          cy +
          Math.sin(phase) * ampPx * 0.7 +
          Math.sin(phase * 2.3 + 1.1) * ampPx * 0.25 +
          Math.sin(phase * 4.7 + 2.9) * ampPx * 0.08;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      if (active) {
        animRef.current.t += 1.5 * speed * dpr;
      }
      animRef.current.raf = requestAnimationFrame(tick);
    };
    animRef.current.raf = requestAnimationFrame(tick);

    return () => {
      disposed = true;
      ro.disconnect();
      if (animRef.current.raf !== null) cancelAnimationFrame(animRef.current.raf);
    };
  }, [active, color, speedPercent]);

  // Z indicativo: usa meshHeightMm se vier, senão deriva do %.
  const zLabel = (() => {
    if (currentLayer != null && totalLayers != null && totalLayers > 0) {
      if (meshHeightMm && meshHeightMm > 0) {
        const z = (currentLayer / totalLayers) * meshHeightMm;
        return `Z ${z.toFixed(1)}mm`;
      }
      return `${currentLayer}/${totalLayers}`;
    }
    return null;
  })();

  return (
    <div
      className={cn('relative inline-flex flex-col items-end gap-0.5', className)}
      aria-hidden
    >
      <canvas
        ref={canvasRef}
        style={{
          width: 'clamp(110px, 16vw, 200px)',
          height: 'clamp(20px, 2.4vw, 32px)',
          display: 'block',
        }}
      />
      {zLabel ? (
        <span
          className="font-mono tabular-nums text-muted-foreground leading-none"
          style={{ fontSize: 'clamp(0.5rem, 0.75vw, 0.6875rem)' }}
        >
          {zLabel}
        </span>
      ) : null}
    </div>
  );
}
