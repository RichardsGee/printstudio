'use client';

import dynamic from 'next/dynamic';
import { Play } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Story 7.7 AC 31-32 — Three.js fica em chunk lazy separado: o hero 3D
// real (Benchy .3mf) só carrega no client (ssr:false), com o HUD
// Mission Control servindo de skeleton durante o load. Bundle inicial
// da landing NÃO inclui Three.js.
const HeroPrintPreview = dynamic(
  () => import('./hero-print-preview').then((m) => m.HeroPrintPreview),
  {
    ssr: false,
    loading: () => <HeroVisualPlaceholder />,
  },
);

interface HeroProps {
  onWaitlistClick: () => void;
  onDemoClick: () => void;
}

/**
 * Hero principal da landing. Comunica valor central: monitoramento
 * remoto de Bambu A1 em qualquer lugar, com visual Mission Control.
 */
export function Hero({ onWaitlistClick, onDemoClick }: HeroProps) {
  return (
    <section
      id="hero"
      className="container max-w-6xl py-16 sm:py-24"
      aria-labelledby="hero-title"
    >
      <div className="grid items-center gap-10 lg:grid-cols-2">
        <div className="space-y-6">
          <p
            data-mc-id
            className="text-caption font-mono uppercase tracking-wider text-primary"
          >
            {'// MISSION-CONTROL · BAMBU LAB A1'}
          </p>
          <h1
            id="hero-title"
            className="text-balance text-4xl font-semibold leading-tight sm:text-5xl lg:text-6xl"
          >
            Monitore suas{' '}
            <span className="text-primary">Bambu Lab A1</span> de qualquer
            lugar
          </h1>
          <p className="text-body-lg text-muted-foreground max-w-xl">
            Painel cloud-nativo com telemetria em tempo real, histórico de
            impressão e alertas. Sem bridge na LAN, sem complicação — só
            login e funciona.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              type="button"
              size="lg"
              onClick={onWaitlistClick}
              className="text-base"
            >
              Entrar na lista de espera
            </Button>
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={onDemoClick}
              className="gap-2 text-base"
            >
              <Play className="size-4" aria-hidden="true" />
              Ver demo (60s)
            </Button>
          </div>
          <p className="text-small text-muted-foreground">
            Acesso antecipado · Sem cartão · Vaga garantida na fila
          </p>
        </div>

        <HeroPrintPreview />
      </div>
    </section>
  );
}

/**
 * Placeholder visual estilo HUD Mission Control enquanto o asset real
 * (gif/webm do kiosk) não está pronto. Usa só tokens — zero imagens.
 */
function HeroVisualPlaceholder() {
  return (
    <div
      className="relative aspect-[4/3] overflow-hidden rounded-lg border border-[var(--mc-accent-soft)]/30 bg-card/40 shadow-xl"
      data-mc-card
      aria-hidden="true"
    >
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--mc-accent-soft)_0%,_transparent_50%)] opacity-30" />
      <div className="relative flex h-full flex-col p-6">
        <div className="flex items-center justify-between">
          <p
            data-mc-id
            className="text-caption font-mono uppercase tracking-wider text-primary"
          >
            {'// LIVE · 3 PRINTERS'}
          </p>
          <span className="inline-flex size-2 animate-pulse rounded-full bg-primary" />
        </div>

        <div className="mt-6 grid flex-1 grid-cols-3 gap-3">
          {[
            { name: 'A1-01', pct: 87, status: 'PRINTING' },
            { name: 'A1-02', pct: 100, status: 'IDLE' },
            { name: 'A1-03', pct: 34, status: 'PRINTING' },
          ].map((p) => (
            <div
              key={p.name}
              className="flex flex-col justify-between rounded-md border border-[var(--mc-accent-soft)]/20 bg-background/40 p-3"
            >
              <p className="text-caption font-mono uppercase tracking-wider text-muted-foreground">
                {p.name}
              </p>
              <div className="space-y-1">
                <p className="text-caption text-primary" data-mc-id>
                  {p.status}
                </p>
                <p className="text-2xl font-semibold">
                  {p.pct}
                  <span className="text-small text-muted-foreground">%</span>
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-[var(--mc-accent-soft)]/20 pt-3">
          <span className="text-caption font-mono uppercase tracking-wider text-muted-foreground">
            UPTIME · 99.9%
          </span>
          <span className="text-caption font-mono uppercase tracking-wider text-muted-foreground">
            {'// CLOUD'}
          </span>
        </div>
      </div>
    </div>
  );
}
