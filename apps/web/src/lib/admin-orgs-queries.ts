import 'server-only';
import { and, desc, eq, ilike, inArray, lt, or, sql } from 'drizzle-orm';
import {
  createDb,
  organizationMembers,
  organizations,
  printers,
  users,
} from '@printstudio/db';
import { PLAN_KEYS, type PlanKey } from '@printstudio/shared';

let _db: ReturnType<typeof createDb> | null = null;
function getDb() {
  if (_db) return _db;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL not set');
  _db = createDb(url);
  return _db;
}

export interface AdminOrgListFilters {
  plan?: PlanKey[];
  /** Busca por nome org OR email owner (ILIKE %q%). */
  q?: string;
  /** Cursor: `created_at` ISO string. Paginação retorna < cursor. */
  cursor?: string;
  /** Default 50, max 200. */
  limit?: number;
}

export interface AdminOrgRow {
  id: string;
  name: string;
  plan: string;
  onboardingStep: string;
  onboardingCompletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  ownerEmail: string;
  ownerName: string | null;
  printerCount: number;
}

export interface AdminOrgListResult {
  rows: AdminOrgRow[];
  nextCursor: string | null;
  hasMore: boolean;
}

const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 50;

/**
 * Lista organizações com owner + count de printers em 1 query (Story 9.5).
 *
 * Strategy:
 * - JOIN `organization_members` filtrando `role='owner'` pra pegar 1 user
 *   por org (a primária)
 * - LEFT JOIN `printers` com `COUNT(*)` agrupado
 * - WHERE conditions (plan IN, q ILIKE em org name OR owner email, cursor)
 * - ORDER BY created_at DESC cursor-based
 *
 * Evita N+1 (não busca cada owner/count individualmente).
 */
export async function listAdminOrgs(
  filters: AdminOrgListFilters = {},
): Promise<AdminOrgListResult> {
  const limit = Math.min(filters.limit ?? DEFAULT_LIMIT, MAX_LIMIT);

  const conds = [eq(organizationMembers.role, 'owner')];
  if (filters.plan && filters.plan.length > 0) {
    conds.push(inArray(organizations.plan, filters.plan));
  }
  if (filters.q && filters.q.trim().length > 0) {
    const pattern = `%${filters.q.trim()}%`;
    const orExpr = or(
      ilike(organizations.name, pattern),
      ilike(users.email, pattern),
    );
    if (orExpr) conds.push(orExpr);
  }
  if (filters.cursor) {
    const cursorDate = new Date(filters.cursor);
    if (!Number.isNaN(cursorDate.getTime())) {
      conds.push(lt(organizations.createdAt, cursorDate));
    }
  }

  const rows = await getDb()
    .select({
      id: organizations.id,
      name: organizations.name,
      plan: organizations.plan,
      onboardingStep: organizations.onboardingStep,
      onboardingCompletedAt: organizations.onboardingCompletedAt,
      createdAt: organizations.createdAt,
      updatedAt: organizations.updatedAt,
      ownerEmail: users.email,
      ownerName: users.name,
      printerCount: sql<number>`COALESCE(COUNT(${printers.id})::int, 0)`,
    })
    .from(organizations)
    .innerJoin(
      organizationMembers,
      eq(organizationMembers.organizationId, organizations.id),
    )
    .innerJoin(users, eq(users.id, organizationMembers.userId))
    .leftJoin(printers, eq(printers.organizationId, organizations.id))
    .where(and(...conds))
    .groupBy(
      organizations.id,
      organizations.name,
      organizations.plan,
      organizations.onboardingStep,
      organizations.onboardingCompletedAt,
      organizations.createdAt,
      organizations.updatedAt,
      users.email,
      users.name,
    )
    .orderBy(desc(organizations.createdAt))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const trimmed = hasMore ? rows.slice(0, limit) : rows;
  const last = trimmed[trimmed.length - 1];
  const nextCursor = hasMore && last ? last.createdAt.toISOString() : null;

  return {
    rows: trimmed as AdminOrgRow[],
    nextCursor,
    hasMore,
  };
}

export interface AdminOrgsMetrics {
  total: number;
  byPlan: Record<string, number>;
  /** Orgs com `onboarding_completed_at != null`. */
  onboarded: number;
  /** % onboarded / total. */
  onboardedPct: number;
}

export async function getAdminOrgsMetrics(): Promise<AdminOrgsMetrics> {
  const db = getDb();
  const [totalRow, byPlanRows, onboardedRow] = await Promise.all([
    db.select({ c: sql<number>`count(*)::int` }).from(organizations),
    db
      .select({ plan: organizations.plan, c: sql<number>`count(*)::int` })
      .from(organizations)
      .groupBy(organizations.plan),
    db
      .select({ c: sql<number>`count(*)::int` })
      .from(organizations)
      .where(sql`${organizations.onboardingCompletedAt} IS NOT NULL`),
  ]);

  const total = totalRow[0]?.c ?? 0;
  const onboarded = onboardedRow[0]?.c ?? 0;
  const byPlan: Record<string, number> = {};
  for (const r of byPlanRows) byPlan[r.plan] = r.c;
  // Garantir keys conhecidas mesmo se vazias
  for (const k of PLAN_KEYS) {
    if (!(k in byPlan)) byPlan[k] = 0;
  }

  return {
    total,
    byPlan,
    onboarded,
    onboardedPct: total > 0 ? (onboarded / total) * 100 : 0,
  };
}
