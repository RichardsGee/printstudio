import type { ReactNode } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/page-header';

/**
 * Layout compartilhado pra páginas legais (privacy + termos).
 * Tipografia consistente com Mission Control + max-width pra leitura.
 *
 * Story 7.4 — Política de privacidade + termo de uso.
 */
interface LegalDocLayoutProps {
  id: string;
  title: string;
  description?: string;
  lastUpdated: string;
  children: ReactNode;
}

export function LegalDocLayout({
  id,
  title,
  description,
  lastUpdated,
  children,
}: LegalDocLayoutProps) {
  return (
    <div className="container max-w-3xl py-12 space-y-8">
      <PageHeader
        id={id}
        title={title}
        description={description}
        showTimestamp={false}
      />
      <div
        data-mc-id
        className="text-caption text-muted-foreground uppercase tracking-wider"
      >
        {`// LAST-UPDATED · ${lastUpdated}`}
      </div>
      <article className="space-y-6 text-body leading-relaxed">{children}</article>
      <footer className="pt-8 border-t border-[var(--mc-accent-soft)]/30 text-small text-muted-foreground">
        <p>
          GuiaPrint3D ·{' '}
          <Link href="/" className="underline hover:text-foreground">
            voltar pra home
          </Link>
        </p>
      </footer>
    </div>
  );
}

/**
 * Heading H2 com tokens Mission Control.
 */
export function H2({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-heading uppercase tracking-wider pt-6 first:pt-0">{children}</h2>
  );
}

/**
 * Heading H3 com tokens Mission Control.
 */
export function H3({ children }: { children: ReactNode }) {
  return <h3 className="text-body-lg font-semibold pt-4">{children}</h3>;
}

/**
 * Parágrafo padrão (text-body com leading relaxed via parent).
 * Aceita className extra pra customizações pontuais.
 */
export function P({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <p className={`text-body${className ? ` ${className}` : ''}`}>{children}</p>;
}

/**
 * Lista UL com bullets.
 */
export function UL({ children }: { children: ReactNode }) {
  return <ul className="list-disc list-inside space-y-1 text-body pl-2">{children}</ul>;
}
