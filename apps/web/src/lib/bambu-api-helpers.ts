/**
 * Helpers compartilhados pelos Route Handlers em /app/api/bambu/*:
 *  - getSessionUser: pega user da sessão NextAuth (ou null)
 *  - resolveUserOrganizationId: org primária do user
 *  - getDb: lazy-init drizzle client
 *  - errorPayload: helper pra retornar erros padronizados
 */

import { eq } from 'drizzle-orm';
import { createDb, organizationMembers, type User } from '@printstudio/db';
import type { BambuErrorCode } from '@printstudio/shared';
import { auth } from '@/lib/auth';

let _db: ReturnType<typeof createDb> | null = null;
export function getDb(): ReturnType<typeof createDb> {
  if (_db) return _db;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL not set');
  _db = createDb(url);
  return _db;
}

export async function getSessionUser(): Promise<Pick<User, 'id' | 'email'> | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  return {
    id: String(session.user.id),
    email: session.user.email ?? '',
  };
}

export async function resolveUserOrganizationId(userId: string): Promise<string | null> {
  const rows = await getDb()
    .select({ orgId: organizationMembers.organizationId })
    .from(organizationMembers)
    .where(eq(organizationMembers.userId, userId))
    .limit(1);
  return rows[0]?.orgId ?? null;
}

export function errorPayload(code: BambuErrorCode, message: string) {
  return { error: { code, message } };
}
