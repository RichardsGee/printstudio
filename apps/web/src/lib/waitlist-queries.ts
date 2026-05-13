import 'server-only';
import { and, desc, eq, ilike, inArray, lt, or, sql } from 'drizzle-orm';
import { createDb, waitlist } from '@printstudio/db';

let _db: ReturnType<typeof createDb> | null = null;
function getDb() {
  if (_db) return _db;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL not set');
  _db = createDb(url);
  return _db;
}

export const WAITLIST_STATUS_VALUES = [
  'new',
  'contacted',
  'engaged',
  'invited',
  'converted',
  'lost',
] as const;
export type WaitlistStatusValue = (typeof WAITLIST_STATUS_VALUES)[number];

export const WAITLIST_ROLE_VALUES = [
  'hobbyist',
  'small_shop',
  'studio',
  'business',
  'other',
] as const;
export type WaitlistRoleValue = (typeof WAITLIST_ROLE_VALUES)[number];

export interface WaitlistListFilters {
  status?: WaitlistStatusValue[];
  role?: WaitlistRoleValue[];
  state?: string[];
  /** Busca por nome OR email (ILIKE %q%). */
  q?: string;
  /** Cursor cursor-based: `created_at` ISO string. Paginação retorna < cursor. */
  cursor?: string;
  /** Tamanho da página (default 50, max 200). */
  limit?: number;
}

export interface WaitlistRow {
  id: string;
  email: string;
  name: string;
  bambuCount: number;
  role: WaitlistRoleValue;
  state: string | null;
  city: string | null;
  telegramHandle: string | null;
  phone: string | null;
  status: WaitlistStatusValue;
  tags: string[];
  notes: string | null;
  contactedAt: Date | null;
  lastContactAt: Date | null;
  createdAt: Date;
}

export interface WaitlistListResult {
  rows: WaitlistRow[];
  /** Cursor pra próxima página (last `createdAt` ISO). null se fim. */
  nextCursor: string | null;
  /** True se filtros aplicados retornaram exatamente `limit` rows. */
  hasMore: boolean;
}

const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 50;

/**
 * Lista waitlist com filtros server-side + paginação cursor-based.
 * Cursor = `created_at` (DESC). Evita OFFSET lento em listas grandes.
 *
 * Story 9.3.
 */
export async function listWaitlist(
  filters: WaitlistListFilters = {},
): Promise<WaitlistListResult> {
  const limit = Math.min(filters.limit ?? DEFAULT_LIMIT, MAX_LIMIT);

  const conds = [];
  if (filters.status && filters.status.length > 0) {
    conds.push(inArray(waitlist.status, filters.status));
  }
  if (filters.role && filters.role.length > 0) {
    conds.push(inArray(waitlist.role, filters.role));
  }
  if (filters.state && filters.state.length > 0) {
    conds.push(inArray(waitlist.state, filters.state));
  }
  if (filters.q && filters.q.trim().length > 0) {
    const pattern = `%${filters.q.trim()}%`;
    const orExpr = or(
      ilike(waitlist.name, pattern),
      ilike(waitlist.email, pattern),
    );
    if (orExpr) conds.push(orExpr);
  }
  if (filters.cursor) {
    const cursorDate = new Date(filters.cursor);
    if (!Number.isNaN(cursorDate.getTime())) {
      conds.push(lt(waitlist.createdAt, cursorDate));
    }
  }

  const whereExpr = conds.length > 0 ? and(...conds) : undefined;

  const rows = await getDb()
    .select({
      id: waitlist.id,
      email: waitlist.email,
      name: waitlist.name,
      bambuCount: waitlist.bambuCount,
      role: waitlist.role,
      state: waitlist.state,
      city: waitlist.city,
      telegramHandle: waitlist.telegramHandle,
      phone: waitlist.phone,
      status: waitlist.status,
      tags: waitlist.tags,
      notes: waitlist.notes,
      contactedAt: waitlist.contactedAt,
      lastContactAt: waitlist.lastContactAt,
      createdAt: waitlist.createdAt,
    })
    .from(waitlist)
    .where(whereExpr)
    .orderBy(desc(waitlist.createdAt))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const trimmed = hasMore ? rows.slice(0, limit) : rows;
  const last = trimmed[trimmed.length - 1];
  const nextCursor = hasMore && last ? last.createdAt.toISOString() : null;

  return {
    rows: trimmed as WaitlistRow[],
    nextCursor,
    hasMore,
  };
}

export interface WaitlistMetrics {
  total: number;
  /** Cadastros nos últimos 7 dias. */
  newLast7d: number;
  /** Total que virou user (`status = 'converted'`). */
  converted: number;
  /** Distribuição por status. */
  byStatus: Record<WaitlistStatusValue, number>;
}

/**
 * Métricas básicas do topo da página (Story 9.3 AC #4).
 * Story 9.8 (Métricas dashboard) traz visualizações mais completas
 * + drop-off de funil consumindo `onboarding_events`.
 */
export async function getWaitlistMetrics(): Promise<WaitlistMetrics> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [totalRow] = await getDb()
    .select({ count: sql<number>`count(*)::int` })
    .from(waitlist);
  const [recentRow] = await getDb()
    .select({ count: sql<number>`count(*)::int` })
    .from(waitlist)
    .where(sql`${waitlist.createdAt} >= ${sevenDaysAgo}`);
  const [convertedRow] = await getDb()
    .select({ count: sql<number>`count(*)::int` })
    .from(waitlist)
    .where(eq(waitlist.status, 'converted'));

  const byStatusRows = await getDb()
    .select({
      status: waitlist.status,
      count: sql<number>`count(*)::int`,
    })
    .from(waitlist)
    .groupBy(waitlist.status);

  const byStatus: Record<WaitlistStatusValue, number> = {
    new: 0,
    contacted: 0,
    engaged: 0,
    invited: 0,
    converted: 0,
    lost: 0,
  };
  for (const row of byStatusRows) {
    byStatus[row.status as WaitlistStatusValue] = row.count;
  }

  return {
    total: totalRow?.count ?? 0,
    newLast7d: recentRow?.count ?? 0,
    converted: convertedRow?.count ?? 0,
    byStatus,
  };
}
