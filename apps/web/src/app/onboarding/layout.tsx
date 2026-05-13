import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { requireCurrentOrg } from '@/lib/current-org';

/**
 * Layout do wizard de onboarding (Story 8.3).
 *
 * Diferente do `(app)` group: SEM AppHeader. Wizard tem identidade
 * própria — só logo + progress indicator + conteúdo focado.
 *
 * Comportamento:
 * - Sem session → redirect /login
 * - Onboarding concluído (`onboardingCompletedAt != null`) → /dashboard
 * - URL não bate com `org.onboarding_step` atual → redirect step correto
 *   (impede usuário pular steps via URL direto)
 */

const STEP_PATHS: Record<string, string> = {
  profile: '/onboarding/profile',
  bambu_connect: '/onboarding/bambu-connect',
  printers: '/onboarding/add-printers',
};

export default async function OnboardingLayout({
  children,
}: {
  children: ReactNode;
}) {
  const org = await requireCurrentOrg();

  if (org.onboardingCompletedAt) {
    redirect('/dashboard');
  }

  const expectedPath = STEP_PATHS[org.onboardingStep];
  if (expectedPath) {
    const hdrs = await headers();
    const currentPath =
      hdrs.get('x-invoke-path') ?? hdrs.get('x-pathname') ?? hdrs.get('next-url') ?? '';
    // currentPath pode vir vazio se headers não forem propagados — só
    // redireciona se tivermos certeza que está no path errado.
    if (currentPath && !currentPath.startsWith(expectedPath)) {
      redirect(expectedPath);
    }
  }

  return (
    <div className="min-h-dvh flex flex-col">
      <header className="border-b border-[var(--mc-accent-soft)]/30">
        <div className="container max-w-3xl flex h-14 items-center justify-between">
          <p
            data-mc-id
            className="text-caption font-mono uppercase tracking-widest text-primary"
          >
            {'// ONBOARDING · GUIAPRINT3D'}
          </p>
          <p className="text-caption font-mono uppercase tracking-wider text-muted-foreground">
            {org.name}
          </p>
        </div>
      </header>
      <main className="flex-1 py-10">{children}</main>
    </div>
  );
}
