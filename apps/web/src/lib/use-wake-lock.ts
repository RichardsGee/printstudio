'use client';

import { useEffect } from 'react';

type WakeLockSentinel = {
  released: boolean;
  release: () => Promise<void>;
  addEventListener: (type: 'release', listener: () => void) => void;
};

type WakeLockNavigator = Navigator & {
  wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinel> };
};

/**
 * Mantém a tela acesa enquanto o componente estiver montado (modo
 * kiosk). Re-adquire o lock quando o documento volta a ser visível
 * — Chrome/Safari liberam automaticamente em background, então o
 * listener de visibilitychange é necessário para retomar.
 *
 * Funciona em Chrome/Edge/Safari modernos. Falha silenciosa em
 * browsers sem suporte (Firefox até v126 não tinha).
 */
export function useWakeLock(active = true): void {
  useEffect(() => {
    if (!active) return;
    if (typeof navigator === 'undefined') return;
    const nav = navigator as WakeLockNavigator;
    if (!nav.wakeLock) return;

    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;

    async function acquire() {
      try {
        const s = await nav.wakeLock!.request('screen');
        if (cancelled) {
          await s.release();
          return;
        }
        sentinel = s;
      } catch {
        // Browser bloqueou (ex: bateria fraca) — segue sem screen lock.
      }
    }

    function onVisibilityChange() {
      if (document.visibilityState === 'visible' && (!sentinel || sentinel.released)) {
        void acquire();
      }
    }

    void acquire();
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibilityChange);
      if (sentinel && !sentinel.released) void sentinel.release();
    };
  }, [active]);
}
