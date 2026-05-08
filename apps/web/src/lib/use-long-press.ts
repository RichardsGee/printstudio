'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface Options {
  /** Tempo em ms até disparar o handler. Default 2000. */
  durationMs?: number;
  /** Disabled = ignora toques/cliques. */
  disabled?: boolean;
}

interface Handlers {
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
  onPointerLeave: (e: React.PointerEvent) => void;
  onPointerCancel: (e: React.PointerEvent) => void;
}

interface Result {
  /** Spread em qualquer elemento clicável. */
  bind: Handlers;
  /** 0..1 — usar pra animar o progresso visual do hold. */
  progress: number;
  /** True enquanto o usuário mantém pressionado. */
  pressing: boolean;
}

/**
 * Long-press hook pra controles destrutivos em modo kiosk (parar,
 * pausar). Exibe progresso 0→1 pra dar feedback visual e cancela
 * em pointerleave/cancel — toque acidental que escorrega não
 * dispara o handler.
 */
export function useLongPress(handler: () => void, opts: Options = {}): Result {
  const { durationMs = 2000, disabled = false } = opts;
  const [progress, setProgress] = useState(0);
  const [pressing, setPressing] = useState(false);
  const startRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);
  const firedRef = useRef<boolean>(false);

  const cancel = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setPressing(false);
    setProgress(0);
    firedRef.current = false;
  }, []);

  useEffect(() => () => cancel(), [cancel]);

  const tick = useCallback(() => {
    const elapsed = performance.now() - startRef.current;
    const p = Math.min(1, elapsed / durationMs);
    setProgress(p);
    if (p >= 1) {
      if (!firedRef.current) {
        firedRef.current = true;
        handler();
      }
      cancel();
      return;
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [durationMs, handler, cancel]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (disabled) return;
      // Captura o pointer pra continuar recebendo eventos mesmo se
      // o dedo escorregar pra fora — mas o pointerleave ainda
      // cancela como safeguard adicional.
      (e.target as Element).setPointerCapture?.(e.pointerId);
      startRef.current = performance.now();
      firedRef.current = false;
      setPressing(true);
      rafRef.current = requestAnimationFrame(tick);
    },
    [disabled, tick],
  );

  return {
    bind: {
      onPointerDown,
      onPointerUp: cancel,
      onPointerLeave: cancel,
      onPointerCancel: cancel,
    },
    progress,
    pressing,
  };
}
