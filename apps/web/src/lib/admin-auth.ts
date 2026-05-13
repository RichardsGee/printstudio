import 'server-only';
import { notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { createDb, users } from '@printstudio/db';
import { auth } from '@/lib/auth';

let _db: ReturnType<typeof createDb> | null = null;
function getDb() {
  if (_db) return _db;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL not set');
  _db = createDb(url);
  return _db;
}

export interface SuperAdminContext {
  userId: string;
  email: string;
  name: string | null;
}

/**
 * Helper de proteção das rotas `/admin/*` (Story 9.1).
 *
 * Comportamento:
 * - Sem session → `notFound()` (404, esconde existência da rota)
 * - User sem `is_super_admin = true` → `notFound()`
 * - OK → retorna contexto pra uso na page
 *
 * Decisão fechada PRD 9: retornar 404 em vez de 403 é security-through-
 * obscurity deliberado pra não revelar pra usuários comuns que `/admin`
 * existe. NÃO é proteção primária — flag no DB é.
 *
 * Single source of truth: `users.is_super_admin` consultado a cada
 * request. Sem cache pra evitar TTL stale em revoga emergencial.
 *
 * Usado por `(admin)/layout.tsx` — todas as páginas embaixo herdam.
 */
export async function requireSuperAdmin(): Promise<SuperAdminContext> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) notFound();

  const rows = await getDb()
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      isSuperAdmin: users.isSuperAdmin,
    })
    .from(users)
    .where(eq(users.id, String(userId)))
    .limit(1);

  const row = rows[0];
  if (!row || !row.isSuperAdmin) notFound();

  return {
    userId: row.id,
    email: row.email,
    name: row.name,
  };
}

/**
 * Versão non-throwing pra checks programáticos (ex: mostrar/esconder
 * link "Admin" no header). Retorna boolean.
 */
export async function isSuperAdmin(): Promise<boolean> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return false;

  const rows = await getDb()
    .select({ isSuperAdmin: users.isSuperAdmin })
    .from(users)
    .where(eq(users.id, String(userId)))
    .limit(1);

  return rows[0]?.isSuperAdmin ?? false;
}
