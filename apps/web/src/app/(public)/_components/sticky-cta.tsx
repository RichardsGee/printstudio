'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { trackEvent } from '@/lib/analytics';
import { cn } from '@/lib/utils';

/**
 * Sticky CTA mobile — Story 7.7 AC 20-22.
 *
 * Barra fixa bottom-0 só em viewport < sm (`sm:hidden`). Esconde via
 * IntersectionObserver quando a section `#waitlist` está visível (AC 21)
 * — não faz sentido empurrar pro form se ele já está na tela.
 *
 * Renderizado dentro do LandingPageClient, então NÃO aparece em
 * `/sucesso` nem nas páginas legais (AC 22) — elas não montam a landing.
 * Começa escondido pra evitar flash até o observer rodar.
 */
export function StickyCta() {
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    const target = document.getElementById('waitlist');
    if (!target) return;
    const obs = new IntersectionObserver(
      ([entry]) => setHidden(entry.isIntersecting),
      { threshold: 0.1 },
    );
    obs.observe(target);
    return () => obs.disconnect();
  }, []);

  function handleClick() {
    trackEvent('cta_waitlist_click');
    document
      .getElementById('waitlist')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <div
      className={cn(
        'fixed inset-x-0 bottom-0 z-40 border-t border-[var(--mc-accent-soft)]/30 bg-background/90 p-3 backdrop-blur transition-transform duration-300 sm:hidden',
        hidden ? 'translate-y-full' : 'translate-y-0',
      )}
      aria-hidden={hidden}
    >
      <Button
        type="button"
        size="lg"
        className="w-full text-base"
        onClick={handleClick}
        tabIndex={hidden ? -1 : 0}
      >
        Entrar na lista
      </Button>
    </div>
  );
}
