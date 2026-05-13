import type { ReactNode } from 'react';
import Link from 'next/link';
import { requireSuperAdmin } from '@/lib/admin-auth';
import { AdminSidebar } from '@/components/admin/admin-sidebar';
import { AdminSidebarMobile } from '@/components/admin/admin-sidebar-mobile';

/**
 * Layout do Admin Panel (Story 9.1 + 9.2).
 *
 * Story 9.1: `requireSuperAdmin()` retorna 404 se user sem flag.
 *
 * Story 9.2: Grid 2-col em desktop (sidebar fixa + content). Em mobile
 * (< lg) sidebar vira drawer Radix Dialog acionado por hamburger.
 *
 * Identidade visual: header próprio com badge SUPER-ADMIN (sem
 * AppHeader normal). Link "← App" pra voltar pro dashboard.
 */
export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const ctx = await requireSuperAdmin();

  return (
    <div className="min-h-dvh flex flex-col">
      <header className="sticky top-0 z-30 border-b border-[var(--mc-accent-soft)]/30 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container max-w-7xl flex h-14 items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="lg:hidden">
              <AdminSidebarMobile />
            </div>
            <Link
              href="/admin"
              data-mc-id
              className="text-caption font-mono uppercase tracking-widest text-primary"
            >
              {'// ADMIN · GUIAPRINT3D'}
            </Link>
            <span
              data-mc-id
              className="hidden sm:inline-flex rounded-md border border-primary/40 bg-primary/10 px-2 py-0.5 text-caption font-mono uppercase tracking-wider text-primary"
            >
              SUPER-ADMIN
            </span>
          </div>
          <div className="flex items-center gap-4 text-caption font-mono uppercase tracking-wider">
            <span className="hidden sm:inline text-muted-foreground">
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

      <div className="container max-w-7xl flex-1 gap-6 py-8 lg:grid lg:grid-cols-[15rem_1fr]">
        <aside className="hidden lg:block">
          <div className="sticky top-20">
            <p
              data-mc-id
              className="mb-2 px-3 text-caption font-mono uppercase tracking-wider text-muted-foreground"
            >
              {'// SECTIONS'}
            </p>
            <AdminSidebar />
          </div>
        </aside>
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
