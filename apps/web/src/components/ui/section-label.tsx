'use client';

import { cn } from '@/lib/utils';

/**
 * Label padrão para títulos de seção dentro de cards e agrupamentos:
 * monoespaçada, caps, tracking amplo, cor muted. Aparece 20+ vezes
 * inline pelas páginas — agora num componente só.
 */
interface Props {
  children: React.ReactNode;
  className?: string;
}

export function SectionLabel({ children, className }: Props) {
  return (
    <div
      className={cn(
        'text-micro font-mono uppercase tracking-wider text-muted-foreground',
        className,
      )}
    >
      {children}
    </div>
  );
}
