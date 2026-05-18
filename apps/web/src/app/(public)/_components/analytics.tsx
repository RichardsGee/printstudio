'use client';

import Script from 'next/script';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { GA_MEASUREMENT_ID, initGa, trackPageView } from '@/lib/analytics';
import {
  CONSENT_EVENT,
  getStoredConsent,
  type ConsentState,
} from '@/lib/consent';

/**
 * Loader do GA4 — Story 7.7 AC 6/8.
 *
 * Só carrega o gtag.js (lazy, afterInteractive) e inicializa quando
 * consent === 'granted'. Reage ao CustomEvent do consent-banner sem
 * reload. Dispara `page_view` no load inicial e a cada mudança de
 * pathname (cobre o push pra /sucesso — AC 8).
 */
export function Analytics() {
  const pathname = usePathname();
  const [consent, setConsent] = useState<ConsentState | null>(null);

  useEffect(() => {
    setConsent(getStoredConsent());
    const handler = (e: Event) => {
      const next = (e as CustomEvent<ConsentState>).detail;
      setConsent(next ?? getStoredConsent());
    };
    window.addEventListener(CONSENT_EVENT, handler);
    return () => window.removeEventListener(CONSENT_EVENT, handler);
  }, []);

  const enabled = consent === 'granted' && !!GA_MEASUREMENT_ID;

  useEffect(() => {
    if (!enabled) return;
    initGa();
    trackPageView(pathname);
  }, [enabled, pathname]);

  if (!enabled) return null;

  return (
    <Script
      id="ga-gtag-src"
      src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
      strategy="afterInteractive"
    />
  );
}
