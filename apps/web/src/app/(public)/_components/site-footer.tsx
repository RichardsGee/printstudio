import Link from 'next/link';

const CURRENT_YEAR = new Date().getFullYear();

/**
 * Footer com links institucionais + copyright.
 * Mantém tipografia caption Mission Control pra consistência.
 */
export function SiteFooter() {
  return (
    <footer className="border-t border-[var(--mc-accent-soft)]/30 bg-card/40">
      <div className="container max-w-6xl py-10">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <p
              data-mc-id
              className="text-caption font-mono uppercase tracking-wider text-primary"
            >
              {'// GUIAPRINT3D'}
            </p>
            <p className="text-small text-muted-foreground">
              Mission Control pra impressoras 3D Bambu Lab.
            </p>
          </div>

          <nav
            aria-label="Links institucionais"
            className="flex flex-wrap gap-x-6 gap-y-2 text-small"
          >
            <Link
              href="#features"
              className="text-muted-foreground hover:text-foreground"
            >
              Recursos
            </Link>
            <Link
              href="/politica-de-privacidade"
              className="text-muted-foreground hover:text-foreground"
            >
              Política de Privacidade
            </Link>
            <Link
              href="/termos-de-uso"
              className="text-muted-foreground hover:text-foreground"
            >
              Termos de Uso
            </Link>
            <a
              href="mailto:suporte@guiaprint3d.com"
              className="text-muted-foreground hover:text-foreground"
            >
              Contato
            </a>
          </nav>
        </div>

        <p className="mt-8 text-caption text-muted-foreground">
          {`guiaprint3d.com © ${CURRENT_YEAR} · Todos os direitos reservados`}
        </p>
      </div>
    </footer>
  );
}
