import type { NextRequest } from 'next/server';
import { PLAN_KEYS, type PlanKey } from '@printstudio/shared';
import { requireSuperAdmin } from '@/lib/admin-auth';
import { logAdminAction } from '@/lib/admin-audit';
import { listAdminOrgs } from '@/lib/admin-orgs-queries';
import { csvFilename, csvResponse, rowsToCsv } from '@/lib/csv-export';

function parsePlans(raw: string | null): PlanKey[] | undefined {
  if (!raw) return undefined;
  const set = new Set<string>(PLAN_KEYS);
  const items = raw.split(',').map((s) => s.trim()).filter((s) => set.has(s)) as PlanKey[];
  return items.length > 0 ? items : undefined;
}

const LARGE_LIMIT = 10_000;

/**
 * GET /api/admin/export/orgs (Story 9.10)
 *
 * Export orgs filtradas (plano + busca) como CSV. Audit log capturado.
 */
export async function GET(req: NextRequest): Promise<Response> {
  const ctx = await requireSuperAdmin();

  const params = req.nextUrl.searchParams;
  const filters = {
    plan: parsePlans(params.get('plan')),
    q: params.get('q') ?? undefined,
    limit: LARGE_LIMIT,
  };

  const result = await listAdminOrgs(filters);

  const csv = rowsToCsv(result.rows, [
    { key: 'createdAt', label: 'Criada em' },
    { key: 'name', label: 'Nome da org' },
    { key: 'ownerEmail', label: 'Email owner' },
    { key: 'ownerName', label: 'Nome owner' },
    { key: 'plan', label: 'Plano' },
    { key: 'onboardingStep', label: 'Onboarding step' },
    { key: 'onboardingCompletedAt', label: 'Onboarding completo em' },
    { key: 'printerCount', label: 'Qtd impressoras' },
    { key: 'updatedAt', label: 'Atualizada em' },
  ]);

  void logAdminAction({
    adminUserId: ctx.userId,
    action: 'admin.export_executed',
    targetType: 'org',
    payload: {
      entity: 'orgs',
      rowCount: result.rows.length,
      hasMore: result.hasMore,
      filters: { plan: filters.plan, q: filters.q },
    },
  });

  return csvResponse(csv, csvFilename('orgs'));
}
