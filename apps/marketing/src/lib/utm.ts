'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { UtmParams } from '@printstudio/shared';

const UTM_KEYS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
] as const;

const STORAGE_KEY = 'printstudio.utm';

/**
 * Hook que captura UTM params da URL atual ou do sessionStorage.
 * UTMs ficam persistidos por toda a sessão pra não se perderem se
 * usuário navegar antes de submitar o form.
 */
export function useUtmParams(): UtmParams {
  const searchParams = useSearchParams();
  const [utm, setUtm] = useState<UtmParams>(undefined);

  useEffect(() => {
    const fromUrl: Record<string, string> = {};
    let hasAny = false;
    for (const key of UTM_KEYS) {
      const value = searchParams.get(key);
      if (value) {
        fromUrl[key] = value.slice(0, 200);
        hasAny = true;
      }
    }

    if (hasAny) {
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(fromUrl));
      } catch {
        // sessionStorage indisponível (Safari private mode) — ignora
      }
      setUtm(fromUrl);
      return;
    }

    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) {
        setUtm(JSON.parse(stored));
      }
    } catch {
      // ignora
    }
  }, [searchParams]);

  return utm;
}

/**
 * Retorna o document.referrer truncado pra 500 chars.
 * Safe pra SSR (retorna undefined).
 */
export function getReferrer(): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const ref = document.referrer;
  if (!ref) return undefined;
  return ref.slice(0, 500);
}
