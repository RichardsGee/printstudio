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
import { createDb, organizationMembers, organizations } from '@printstudio/db';
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

export interface CurrentOrgSummary {
  id: string;
  name: string;
  plan: string;
  onboardingStep: string;
  onboardingCompletedAt: Date | null;
  role: string | null;
  state: string | null;
  city: string | null;
  waitlistId: string | null;
}

/**
 * Retorna a org corrente com colunas relevantes pro onboarding wizard
 * (Story 8.3). Redireciona pra /login se sem session.
 */
export async function requireCurrentOrg(): Promise<CurrentOrgSummary> {
  const orgId = await requireCurrentOrgId();
  const rows = await getDb()
    .select({
      id: organizations.id,
      name: organizations.name,
      plan: organizations.plan,
      onboardingStep: organizations.onboardingStep,
      onboardingCompletedAt: organizations.onboardingCompletedAt,
      role: organizations.role,
      state: organizations.state,
      city: organizations.city,
      waitlistId: organizations.waitlistId,
    })
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1);
  const org = rows[0];
  if (!org) redirect('/login');
  return org;
}
