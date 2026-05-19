'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { getStoredConsent, storeConsent } from '@/lib/consent';

/**
 * Banner de consentimento LGPD — Story 7.7 AC 7.
 *
 * Discreto, bottom-left, dismissable. Só aparece se ainda não há
 * decisão (`getStoredConsent() === null`). `visible` começa false pra
 * evitar hydration mismatch — só liga no client após checar storage.
 *
 * Aceitar → consent 'granted' (dispara init GA via CustomEvent).
 * Recusar → consent 'denied' (GA nunca carrega).
 */
export function ConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (getStoredConsent() === null) setVisible(true);
  }, []);

  if (!visible) return null;

  const decide = (state: 'granted' | 'denied') => {
    storeConsent(state);
    setVisible(false);
  };

  return (
    <div
      role="dialog"
      aria-label="Consentimento de cookies"
      className="fixed bottom-4 left-4 z-50 max-w-sm rounded-lg border border-[var(--mc-accent-soft)]/30 bg-card/95 p-4 shadow-xl backdrop-blur supports-[backdrop-filter]:bg-card/80"
      data-mc-card
    >
      <p className="text-small leading-relaxed text-muted-foreground">
        Usamos cookies pra entender o uso do site e melhorar a experiência.{' '}
        <Link
          href="/politica-de-privacidade#cookies"
          className="text-primary underline-offset-2 hover:underline"
        >
          Saiba mais
        </Link>
      </p>
      <div className="mt-3 flex gap-2">
        <Button type="button" size="sm" onClick={() => decide('granted')}>
          Aceitar
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => decide('denied')}
        >
          Recusar
        </Button>
      </div>
    </div>
  );
}
