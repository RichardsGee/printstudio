import 'server-only';
import { and, desc, eq, inArray, lt, sql } from 'drizzle-orm';
import { adminAuditLog, createDb, users } from '@printstudio/db';

let _db: ReturnType<typeof createDb> | null = null;
function getDb() {
  if (_db) return _db;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL not set');
  _db = createDb(url);
  return _db;
}

export interface AdminAuditFilters {
  action?: string[];
  targetType?: string[];
  cursor?: string;
  limit?: number;
}

export interface AdminAuditRow {
  id: string;
  adminUserId: string;
  adminEmail: string;
  adminName: string | null;
  action: string;
  targetType: string;
  targetId: string | null;
  payload: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: Date;
}

export interface AdminAuditListResult {
  rows: AdminAuditRow[];
  nextCursor: string | null;
  hasMore: boolean;
  /** Lista distinta de actions presentes no DB (pra dropdown filter). */
  knownActions: string[];
  /** Lista distinta de target types (pra dropdown filter). */
  knownTargetTypes: string[];
}

const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 50;

/**
 * Lista entradas do audit log (Story 9.9). Cursor-based por
 * `created_at DESC`. JOIN com users pra mostrar quem fez a ação.
 *
 * Também retorna lists de actions/target_types distintos pro filter
 * dropdown — 2 queries adicionais leves (ambas com GROUP BY indexed).
 */
export async function listAdminAudit(
  filters: AdminAuditFilters = {},
): Promise<AdminAuditListResult> {
  const limit = Math.min(filters.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
  const db = getDb();

  const conds = [];
  if (filters.action && filters.action.length > 0) {
    conds.push(inArray(adminAuditLog.action, filters.action));
  }
  if (filters.targetType && filters.targetType.length > 0) {
    conds.push(inArray(adminAuditLog.targetType, filters.targetType));
  }
  if (filters.cursor) {
    const cursorDate = new Date(filters.cursor);
    if (!Number.isNaN(cursorDate.getTime())) {
      conds.push(lt(adminAuditLog.createdAt, cursorDate));
    }
  }

  const [rows, knownActionsRows, knownTypesRows] = await Promise.all([
    db
      .select({
        id: adminAuditLog.id,
        adminUserId: adminAuditLog.adminUserId,
        adminEmail: users.email,
        adminName: users.name,
        action: adminAuditLog.action,
        targetType: adminAuditLog.targetType,
        targetId: adminAuditLog.targetId,
        payload: adminAuditLog.payload,
        ipAddress: adminAuditLog.ipAddress,
        createdAt: adminAuditLog.createdAt,
      })
      .from(adminAuditLog)
      .innerJoin(users, eq(users.id, adminAuditLog.adminUserId))
      .where(conds.length > 0 ? and(...conds) : undefined)
      .orderBy(desc(adminAuditLog.createdAt))
      .limit(limit + 1),

    db
      .select({ action: adminAuditLog.action })
      .from(adminAuditLog)
      .groupBy(adminAuditLog.action)
      .orderBy(sql`min(${adminAuditLog.action})`),

    db
      .select({ targetType: adminAuditLog.targetType })
      .from(adminAuditLog)
      .groupBy(adminAuditLog.targetType)
      .orderBy(sql`min(${adminAuditLog.targetType})`),
  ]);

  const hasMore = rows.length > limit;
  const trimmed = hasMore ? rows.slice(0, limit) : rows;
  const last = trimmed[trimmed.length - 1];
  const nextCursor = hasMore && last ? last.createdAt.toISOString() : null;

  return {
    rows: trimmed.map((r) => ({
      ...r,
      ipAddress: r.ipAddress ?? null,
      payload: (r.payload as Record<string, unknown> | null) ?? null,
    })),
    nextCursor,
    hasMore,
    knownActions: knownActionsRows.map((r) => r.action),
    knownTargetTypes: knownTypesRows.map((r) => r.targetType),
  };
}
