import type { ReactNode } from 'react';

/**
 * Layout do route group público — Story 7.7 AC 2.
 *
 * Route groups com parênteses NÃO criam segmento de path: `(public)/`
 * é só um agrupamento. Este layout existe pra isolar as rotas públicas
 * (`/`, `/sucesso`, `/politica-de-privacidade`, `/termos-de-uso`) do
 * shell autenticado — elas NÃO herdam o layout do `(app)/` (sidebar,
 * guards de sessão). O html/body + tema Mission Control vêm do root
 * layout (`app/layout.tsx`, body.kiosk-mission).
 *
 * SiteHeader/SiteFooter ficam dentro do LandingPageClient (só a
 * landing tem header marketing); páginas legais/sucesso renderizam o
 * próprio chrome. Por isso este layout é um passthrough fino.
 */
export default function PublicLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <>{children}</>;
}
