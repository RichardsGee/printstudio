'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface SiteHeaderProps {
  onWaitlistClick: () => void;
  onDemoClick: () => void;
}

/**
 * Header sticky com logo + CTAs de waitlist e demo.
 * Logo segue padrão Mission Control: `// GUIAPRINT3D`.
 */
export function SiteHeader({ onWaitlistClick, onDemoClick }: SiteHeaderProps) {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-[var(--mc-accent-soft)]/30 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 max-w-6xl items-center justify-between gap-4">
        <Link
          href="/"
          className="text-caption font-mono uppercase tracking-wider text-primary"
          data-mc-id
        >
          {'// GUIAPRINT3D'}
        </Link>
        <nav className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onDemoClick}
            className="hidden sm:inline-flex"
          >
            Ver demo
          </Button>
          <Button type="button" size="sm" onClick={onWaitlistClick}>
            Entrar na lista
          </Button>
        </nav>
      </div>
    </header>
  );
}
