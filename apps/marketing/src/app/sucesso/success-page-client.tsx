'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { trackEvent } from '@/lib/analytics';

/**
 * Conteúdo client da página de sucesso. Dispara evento de tracking no
 * mount uma única vez.
 */
export function SuccessPageClient() {
  useEffect(() => {
    trackEvent('waitlist_signup_success');
  }, []);

  return (
    <div className="container max-w-2xl py-16 sm:py-24">
      <div className="space-y-8 text-center">
        <PageHeader
          id="STATUS"
          title="CONFIRMED"
          description="Cadastro registrado com sucesso na lista de espera."
          showTimestamp={false}
        />

        <div
          data-mc-card
          className="space-y-6 rounded-lg border border-[var(--mc-accent-soft)]/30 bg-card/40 p-8 sm:p-10"
        >
          <div className="flex justify-center">
            <div
              className="inline-flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary"
              aria-hidden="true"
            >
              <CheckCircle2 className="size-8" />
            </div>
          </div>

          <div className="space-y-3">
            <h2 className="text-2xl font-semibold sm:text-3xl">
              Você está na lista
            </h2>
            <p className="text-body text-muted-foreground">
              Vamos te avisar assim que o acesso abrir.
            </p>
          </div>

          <p className="text-small text-muted-foreground">
            Em breve você recebe novidades por email. Se tiver dúvidas, fale
            com a gente em{' '}
            <a
              href="mailto:suporte@guiaprint3d.com"
              className="text-primary underline-offset-2 hover:underline"
            >
              suporte@guiaprint3d.com
            </a>
            .
          </p>

          <div className="pt-2">
            <Button asChild variant="outline" size="lg">
              <Link href="/">Voltar pra home</Link>
            </Button>
          </div>
        </div>

        <p
          data-mc-id
          className="text-caption font-mono uppercase tracking-wider text-muted-foreground"
        >
          {'// SIGNAL · ACKNOWLEDGED'}
        </p>
      </div>
    </div>
  );
}
