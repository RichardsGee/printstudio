'use server';

import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { createDb, organizations } from '@printstudio/db';
import type { OnboardingErrorCode } from '@printstudio/shared';
import { requireCurrentOrg } from '@/lib/current-org';
import { trackOnboardingEvent } from '@/lib/onboarding-analytics';

function getDb() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL not set');
  return createDb(url);
}

export interface OnboardingActionResult {
  ok: boolean;
  error?: { code: OnboardingErrorCode; message: string };
}

/**
 * Avança state machine de `bambu_connect` → `printers` (Story 8.4 →
 * Story 8.5). Chamado após sucesso na conexão Bambu Cloud.
 *
 * Garante step atual correto pra impedir replay/skip.
 */
export async function advanceOnboardingStep(): Promise<OnboardingActionResult> {
  const org = await requireCurrentOrg();
  if (org.onboardingStep !== 'bambu_connect') {
    return {
      ok: false,
      error: { code: 'WRONG_STEP', message: 'Step incorreto' },
    };
  }

  try {
    await getDb()
      .update(organizations)
      .set({
        onboardingStep: 'printers',
        updatedAt: new Date(),
      })
      .where(eq(organizations.id, org.id));
  } catch {
    return {
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: 'Erro ao avançar.' },
    };
  }

  // Fire-and-forget tracking — Story 8.10
  void trackOnboardingEvent(org.id, 'bambu_completed');

  redirect('/onboarding/add-printers');
}

/**
 * Pula o step Bambu Connect — marca onboarding como concluído (`skipped`)
 * e redireciona pra dashboard. User pode vincular depois em
 * `/settings/bambu-connect` (banner persistente Story 8.7 lembra).
 *
 * Decisão fechada PRD 8: skip é permitido neste step (não é destrutivo).
 */
export async function skipBambuConnect(): Promise<OnboardingActionResult> {
  const org = await requireCurrentOrg();
  if (org.onboardingStep !== 'bambu_connect') {
    return {
      ok: false,
      error: { code: 'WRONG_STEP', message: 'Step incorreto' },
    };
  }

  const now = new Date();
  try {
    await getDb()
      .update(organizations)
      .set({
        onboardingStep: 'skipped',
        onboardingCompletedAt: now,
        updatedAt: now,
      })
      .where(eq(organizations.id, org.id));
  } catch {
    return {
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: 'Erro ao pular.' },
    };
  }

  // Fire-and-forget tracking — Story 8.10
  void trackOnboardingEvent(org.id, 'bambu_skipped');

  redirect('/dashboard');
}
