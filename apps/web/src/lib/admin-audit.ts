import 'server-only';
import { headers } from 'next/headers';
import { adminAuditLog, createDb } from '@printstudio/db';

let _db: ReturnType<typeof createDb> | null = null;
function getDb() {
  if (_db) return _db;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL not set');
  _db = createDb(url);
  return _db;
}

/**
 * Helper de audit trail (Story 9.9) — fire-and-forget.
 *
 * Cada ação destrutiva ou sensitive no Admin Panel chama isso:
 * - `action`: nome canônico (`waitlist.status_changed`, `org.plan_changed`, etc)
 * - `targetType`: 'waitlist' | 'org' | 'user' | 'subscription'
 * - `targetId`: UUID do alvo (opcional pra ações sem alvo específico)
 * - `payload`: `{ before, after, justification?, ...metadata }`
 *
 * Se INSERT falhar, loga warning no console mas NÃO throws — auditoria
 * é importante, mas request não deve quebrar por log perdido.
 * NUNCA passar PII sensível (senha, CPF, etc) no payload.
 */
export async function logAdminAction(input: {
  adminUserId: string;
  action: string;
  targetType: string;
  targetId?: string | null;
  payload?: Record<string, unknown>;
}): Promise<void> {
  let ipAddress: string | null = null;
  try {
    const hdrs = await headers();
    const xff = hdrs.get('x-forwarded-for');
    if (xff) {
      ipAddress = xff.split(',')[0]?.trim() ?? null;
    } else {
      ipAddress = hdrs.get('x-real-ip') ?? null;
    }
  } catch {
    // headers() pode falhar em contextos sem request (ex: testes) — ignora
  }

  try {
    await getDb()
      .insert(adminAuditLog)
      .values({
        adminUserId: input.adminUserId,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId ?? null,
        payload: input.payload ?? null,
        ipAddress,
      });
  } catch (err) {
    console.warn('[admin-audit] failed to insert audit entry', {
      action: input.action,
      err: err instanceof Error ? err.message : String(err),
    });
  }
}
