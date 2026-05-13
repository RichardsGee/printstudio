'use server';

import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { createDb, organizations } from '@printstudio/db';
import {
  OrgProfileSchema,
  type OnboardingErrorCode,
  type OrgProfileInput,
} from '@printstudio/shared';
import { requireCurrentOrg } from '@/lib/current-org';
import { trackOnboardingEvent } from '@/lib/onboarding-analytics';

function getDb() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL not set');
  return createDb(url);
}

export interface UpdateOrgProfileResult {
  ok: boolean;
  error?: {
    code: OnboardingErrorCode;
    message: string;
    field?: string;
  };
}

/**
 * Server action do step 1 — atualiza profile da org e avança state
 * machine pra `bambu_connect`. Em sucesso, redireciona pro próximo step.
 *
 * Garantias:
 * - Só atualiza se onboarding_step atual === 'profile' (impede pular
 *   steps via replay de form)
 * - Só atualiza se user é dono da org corrente (via requireCurrentOrg)
 * - Em erro de validação, retorna result com error code pra UI renderizar
 *   inline (não throw — preserva input do user)
 */
export async function updateOrgProfile(
  input: OrgProfileInput,
): Promise<UpdateOrgProfileResult> {
  const parsed = OrgProfileSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      ok: false,
      error: {
        code: 'INVALID_PAYLOAD',
        message: issue?.message ?? 'Dados inválidos',
        field: issue?.path[0]?.toString(),
      },
    };
  }

  const org = await requireCurrentOrg();
  if (org.onboardingStep !== 'profile') {
    return {
      ok: false,
      error: {
        code: 'WRONG_STEP',
        message: 'Esse step já foi concluído',
      },
    };
  }

  try {
    await getDb()
      .update(organizations)
      .set({
        name: parsed.data.orgName,
        state: parsed.data.state,
        city: parsed.data.city && parsed.data.city.length > 0 ? parsed.data.city : null,
        role: parsed.data.role,
        onboardingStep: 'bambu_connect',
        updatedAt: new Date(),
      })
      .where(eq(organizations.id, org.id));
  } catch {
    return {
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Erro ao salvar. Tente novamente.',
      },
    };
  }

  // Fire-and-forget tracking — Story 8.10
  void trackOnboardingEvent(org.id, 'profile_completed', {
    role: parsed.data.role,
    state: parsed.data.state,
    fromInvite: org.waitlistId !== null,
  });

  // redirect() throws a special Next.js error — precisa ficar fora do
  // try/catch pra não ser capturado por engano.
  redirect('/onboarding/bambu-connect');
}
