'use server';

import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { createDb, organizations } from '@printstudio/db';
import { PLAN_KEYS } from '@printstudio/shared';
import { requireSuperAdmin } from '@/lib/admin-auth';

function getDb() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL not set');
  return createDb(url);
}

const ChangePlanInput = z.object({
  orgId: z.string().uuid(),
  plan: z.enum(PLAN_KEYS),
  justification: z
    .string()
    .trim()
    .min(10, 'Justificativa precisa ter pelo menos 10 caracteres')
    .max(500, 'Justificativa muito longa'),
});

export interface ChangePlanResult {
  ok: boolean;
  error?: string;
}

/**
 * Override manual de plano por super_admin (Story 9.6).
 *
 * Comportamento:
 * - Valida payload (Zod strict)
 * - Justificativa obrigatória (min 10 chars) pra audit/compliance
 * - UPDATE org.plan + updatedAt
 * - Logs estruturados pra trail mínimo enquanto Story 9.9 (audit log
 *   table) não existir
 *
 * NÃO sincroniza com Asaas V1 (Epic 6 pendente). Quando Asaas entrar,
 * webhook de plan_changed via DB → Asaas precisa ser implementado.
 *
 * V1.1 quando Story 9.9 tiver audit_log table: persistir before/after
 * + justificativa lá em vez de só console.log.
 */
export async function changeOrgPlan(
  raw: { orgId: string; plan: string; justification: string },
): Promise<ChangePlanResult> {
  const ctx = await requireSuperAdmin();
  const parsed = ChangePlanInput.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'Inválido',
    };
  }

  const db = getDb();
  try {
    // 1. Capturar plano antes pra audit trail
    const before = await db
      .select({ plan: organizations.plan })
      .from(organizations)
      .where(eq(organizations.id, parsed.data.orgId))
      .limit(1);
    if (before.length === 0) {
      return { ok: false, error: 'Organização não encontrada' };
    }
    const oldPlan = before[0]?.plan;

    if (oldPlan === parsed.data.plan) {
      return { ok: false, error: 'Plano já é o atual' };
    }

    // 2. UPDATE
    await db
      .update(organizations)
      .set({ plan: parsed.data.plan, updatedAt: new Date() })
      .where(eq(organizations.id, parsed.data.orgId));

    // 3. Trail mínimo via console (Story 9.9 fará table real).
    // Cache de plan-limits no apps/api tem TTL 60s (Story 8.6) —
    // TTL natural cobre delay aceitável até refresh.
    console.warn(
      JSON.stringify({
        event: 'admin.org_plan_changed',
        adminUserId: ctx.userId,
        adminEmail: ctx.email,
        orgId: parsed.data.orgId,
        before: oldPlan,
        after: parsed.data.plan,
        justification: parsed.data.justification,
        timestamp: new Date().toISOString(),
      }),
    );
  } catch {
    return { ok: false, error: 'Erro ao mudar plano' };
  }

  revalidatePath(`/admin/orgs/${parsed.data.orgId}`);
  revalidatePath('/admin/orgs');
  return { ok: true };
}
