'use server';

import { redirect } from 'next/navigation';
import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { createDb, organizations, printers } from '@printstudio/db';
import {
  canAddPrintersFor,
  getPlanLimits,
  type OnboardingErrorCode,
} from '@printstudio/shared';
import { requireCurrentOrg } from '@/lib/current-org';
import { trackOnboardingEvent } from '@/lib/onboarding-analytics';

function getDb() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL not set');
  return createDb(url);
}

/**
 * Schema dos devices Bambu que o user escolhe vincular. `name` pode ser
 * customizado (default = nome Bambu original). `model` vem da Bambu.
 */
const PrinterSelectionSchema = z.object({
  serial: z.string().trim().min(1).max(100),
  name: z.string().trim().min(1).max(100),
  model: z.string().trim().min(1).max(50),
});
export type PrinterSelectionInput = z.infer<typeof PrinterSelectionSchema>;

export interface AddPrintersResult {
  ok: boolean;
  error?: {
    code: OnboardingErrorCode | 'FREE_TIER_LIMIT' | 'EMPTY_SELECTION';
    message: string;
  };
}

/**
 * Server action do step 3 do wizard (Story 8.5).
 *
 * Insere printers selecionadas + finaliza onboarding atomicamente:
 *   - INSERT printers com display_order incremental
 *   - UPDATE org.onboarding_step = 'done' + onboarding_completed_at = now()
 *
 * Plan enforcement via `canAddPrintersFor` do `@printstudio/shared`
 * (Story 8.6) — single source of truth pros limites. Backend valida
 * apesar do radio na UI.
 *
 * Em sucesso, redireciona pra `/kiosk` (Mission Control com a primeira
 * impressora). Erros voltam como result pra UI mostrar inline.
 */
export async function addPrintersFromBambu(
  selections: PrinterSelectionInput[],
): Promise<AddPrintersResult> {
  const parsed = z.array(PrinterSelectionSchema).min(1).safeParse(selections);
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: 'EMPTY_SELECTION',
        message: 'Selecione pelo menos 1 impressora',
      },
    };
  }

  const org = await requireCurrentOrg();
  if (org.onboardingStep !== 'printers') {
    return {
      ok: false,
      error: { code: 'WRONG_STEP', message: 'Step incorreto' },
    };
  }

  // Plan enforcement — usa helper compartilhado (Story 8.6)
  const quota = canAddPrintersFor(org.plan, 0, parsed.data.length);
  if (!quota.allowed) {
    const limits = getPlanLimits(org.plan);
    return {
      ok: false,
      error: {
        code: 'FREE_TIER_LIMIT',
        message: `Plano ${org.plan} permite no máximo ${limits.maxPrinters} impressora${limits.maxPrinters === 1 ? '' : 's'}. Selecione menos ou faça upgrade.`,
      },
    };
  }

  const db = getDb();
  const now = new Date();

  try {
    await db.transaction(async (tx) => {
      // Calcula próximo displayOrder pra essa org (max + 1, ou 0 se vazio)
      const rows = await tx
        .select({
          maxOrder: sql<number | null>`MAX(${printers.displayOrder})`,
        })
        .from(printers)
        .where(eq(printers.organizationId, org.id));
      const baseOrder = (rows[0]?.maxOrder ?? -1) + 1;

      // INSERT printers (skip serial já existente — UNIQUE org+serial)
      for (let i = 0; i < parsed.data.length; i++) {
        const p = parsed.data[i]!;
        await tx
          .insert(printers)
          .values({
            organizationId: org.id,
            name: p.name,
            serial: p.serial,
            // Cloud-managed: accessCode vazio (auth via Bambu Cloud JWT
            // no worker, não LAN access code). Mesmo padrão do
            // worker/printer-registry.
            accessCode: '',
            model: p.model,
            displayOrder: baseOrder + i,
          })
          .onConflictDoNothing({
            target: [printers.organizationId, printers.serial],
          });
      }

      await tx
        .update(organizations)
        .set({
          onboardingStep: 'done',
          onboardingCompletedAt: now,
          updatedAt: now,
        })
        .where(
          and(
            eq(organizations.id, org.id),
            eq(organizations.onboardingStep, 'printers'),
          ),
        );
    });
  } catch {
    return {
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: 'Erro ao adicionar impressoras' },
    };
  }

  // Fire-and-forget tracking — Story 8.10
  void trackOnboardingEvent(org.id, 'printers_added', {
    count: parsed.data.length,
    plan: org.plan,
  });

  // redirect() throws NEXT_REDIRECT — fora do try/catch
  redirect('/kiosk');
}

/**
 * Pula o step add-printers. Marca onboarding como concluído sem
 * registrar impressoras. User pode adicionar depois manualmente
 * (Story 8.7 banner persistente).
 */
export async function skipAddPrinters(): Promise<AddPrintersResult> {
  const org = await requireCurrentOrg();
  if (org.onboardingStep !== 'printers') {
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
  void trackOnboardingEvent(org.id, 'printers_skipped');

  redirect('/dashboard');
}
