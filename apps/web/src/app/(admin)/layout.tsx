import type { ReactNode } from 'react';
import Link from 'next/link';
import { requireSuperAdmin } from '@/lib/admin-auth';

/**
 * Layout do Admin Panel (Story 9.1).
 *
 * Protegido por `requireSuperAdmin()` que retorna 404 (notFound) pra
 * qualquer user sem o flag `is_super_admin`. Decisão fechada PRD 9:
 * 404 em vez de 403 esconde existência da rota.
 *
 * Layout próprio (sem AppHeader normal) — Admin tem identidade visual
 * própria: badge SUPER-ADMIN no topo, navegação dedicada.
 *
 * Stories 9.2+ vão adicionar nav lateral, mas a foundation é só essa.
 */
export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const ctx = await requireSuperAdmin();

  return (
    <div className="min-h-dvh flex flex-col">
      <header className="border-b border-[var(--mc-accent-soft)]/30 bg-card/40">
        <div className="container max-w-6xl flex h-14 items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link
              href="/admin"
              data-mc-id
              className="text-caption font-mono uppercase tracking-widest text-primary"
            >
              {'// ADMIN · GUIAPRINT3D'}
            </Link>
            <span
              data-mc-id
              className="rounded-md border border-primary/40 bg-primary/10 px-2 py-0.5 text-caption font-mono uppercase tracking-wider text-primary"
            >
              SUPER-ADMIN
            </span>
          </div>
          <div className="flex items-center gap-4 text-caption font-mono uppercase tracking-wider">
            <span className="text-muted-foreground">
              {ctx.email}
            </span>
            <Link
              href="/dashboard"
              className="text-muted-foreground hover:text-foreground"
            >
              ← App
            </Link>
          </div>
        </div>
      </header>
      <main className="flex-1 py-10">{children}</main>
    </div>
  );
}
