'use client';

import { Suspense, useCallback, useState } from 'react';
import { SiteHeader } from './site-header';
import { Hero } from './hero';
import { Features } from './features';
import { Faq } from './faq';
import { WaitlistForm } from './waitlist-form';
import { DemoModal } from './demo-modal';
import { SiteFooter } from './site-footer';
import { StickyCta } from './sticky-cta';
import { trackEvent } from '@/lib/analytics';

/**
 * Orquestra o state da landing: modal de demo + scroll suave pro form
 * de waitlist. Server Component (page.tsx) delega aqui o que precisa
 * de client-side state.
 */
export function LandingPageClient() {
  const [demoOpen, setDemoOpen] = useState(false);

  const handleWaitlistClick = useCallback(() => {
    trackEvent('cta_waitlist_click');
    const el = document.getElementById('waitlist');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  const handleDemoClick = useCallback(() => {
    trackEvent('demo_modal_open');
    setDemoOpen(true);
  }, []);

  return (
    <>
      <SiteHeader
        onWaitlistClick={handleWaitlistClick}
        onDemoClick={handleDemoClick}
      />

      <main>
        <Hero
          onWaitlistClick={handleWaitlistClick}
          onDemoClick={handleDemoClick}
        />
        <Features />
        <Faq />
        <Suspense fallback={null}>
          <WaitlistForm />
        </Suspense>
      </main>

      <SiteFooter />

      <StickyCta />

      <DemoModal open={demoOpen} onOpenChange={setDemoOpen} />
    </>
  );
}
