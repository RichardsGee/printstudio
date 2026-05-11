/**
 * Helper pra resolver a organização atual do user logado em Server
 * Components do Next.js (Story 4.6 — filtros multi-tenant).
 *
 * MVP: 1 user pertence a 1 org. Quando suportarmos múltiplas orgs por
 * user, este helper passa a ler um cookie/header `x-org-id` e validar
 * que o user é member.
 */

import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { createDb, organizationMembers } from '@printstudio/db';
import { auth } from '@/lib/auth';

let _db: ReturnType<typeof createDb> | null = null;
function getDb() {
  if (_db) return _db;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL not set');
  _db = createDb(url);
  return _db;
}

/**
 * Retorna o ID da organização primária do user autenticado, ou null
 * se não houver session.
 */
export async function getCurrentOrgId(): Promise<string | null> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;
  const rows = await getDb()
    .select({ orgId: organizationMembers.organizationId })
    .from(organizationMembers)
    .where(eq(organizationMembers.userId, String(userId)))
    .limit(1);
  return rows[0]?.orgId ?? null;
}

/**
 * Mesma coisa que getCurrentOrgId, mas redireciona pra /login se não
 * houver session. Útil em Server Components que ASSUMEM user logado.
 */
export async function requireCurrentOrgId(): Promise<string> {
  const orgId = await getCurrentOrgId();
  if (!orgId) redirect('/login');
  return orgId;
}
