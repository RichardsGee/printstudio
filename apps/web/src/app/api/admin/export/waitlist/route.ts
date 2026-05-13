import type { NextRequest } from 'next/server';
import { BR_STATES } from '@printstudio/shared';
import { requireSuperAdmin } from '@/lib/admin-auth';
import { logAdminAction } from '@/lib/admin-audit';
import {
  listWaitlist,
  WAITLIST_ROLE_VALUES,
  WAITLIST_STATUS_VALUES,
  type WaitlistRoleValue,
  type WaitlistStatusValue,
} from '@/lib/waitlist-queries';
import { csvFilename, csvResponse, rowsToCsv } from '@/lib/csv-export';

function parseCsv<T extends string>(
  raw: string | null,
  allowed: readonly T[],
): T[] | undefined {
  if (!raw) return undefined;
  const set = new Set<string>(allowed);
  const items = raw.split(',').map((s) => s.trim()).filter((s) => set.has(s)) as T[];
  return items.length > 0 ? items : undefined;
}

const LARGE_LIMIT = 10_000;

/**
 * GET /api/admin/export/waitlist
 *
 * Story 9.10 — Export waitlist filtrada como CSV. Aplica os mesmos
 * filtros da listagem (status, role, state, q). Limit 10k rows.
 *
 * Sem super_admin → 404 (esconde rota).
 * Audit log entry com `entity=waitlist`, `row_count`, e `filter_summary`.
 */
export async function GET(req: NextRequest): Promise<Response> {
  const ctx = await requireSuperAdmin();

  const params = req.nextUrl.searchParams;
  const filters = {
    status: parseCsv<WaitlistStatusValue>(params.get('status'), WAITLIST_STATUS_VALUES),
    role: parseCsv<WaitlistRoleValue>(params.get('role'), WAITLIST_ROLE_VALUES),
    state: parseCsv<string>(params.get('state'), BR_STATES),
    q: params.get('q') ?? undefined,
    limit: LARGE_LIMIT,
  };

  const result = await listWaitlist(filters);

  const csv = rowsToCsv(result.rows, [
    { key: 'createdAt', label: 'Criado em' },
    { key: 'name', label: 'Nome' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'WhatsApp' },
    { key: 'telegramHandle', label: 'Telegram' },
    { key: 'state', label: 'UF' },
    { key: 'city', label: 'Cidade' },
    { key: 'role', label: 'Uso' },
    { key: 'bambuCount', label: 'Qtd Bambu' },
    { key: 'status', label: 'Status' },
    { key: 'tags', label: 'Tags' },
    { key: 'notes', label: 'Notes' },
    { key: 'lastContactAt', label: 'Último contato' },
  ]);

  void logAdminAction({
    adminUserId: ctx.userId,
    action: 'admin.export_executed',
    targetType: 'waitlist',
    payload: {
      entity: 'waitlist',
      rowCount: result.rows.length,
      hasMore: result.hasMore,
      filters: {
        status: filters.status,
        role: filters.role,
        state: filters.state,
        q: filters.q,
      },
    },
  });

  return csvResponse(csv, csvFilename('waitlist'));
}
