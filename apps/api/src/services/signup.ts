import { and, eq, isNull, gt, lt } from 'drizzle-orm';
import {
  inviteTokens,
  organizationMembers,
  organizations,
  users,
  waitlist,
  waitlistRoleEnum,
} from '@printstudio/db';
import type { SignupErrorCode } from '@printstudio/shared';
import { db, type Db } from '../db.js';
import { logger } from '../logger.js';

type WaitlistRoleValue = (typeof waitlistRoleEnum.enumValues)[number];

/**
 * Service createUserWithOrg (Story 8.2).
 *
 * Cria 3 entidades atomicamente quando lead vira user:
 * 1. users row
 * 2. organizations row (name = "Org de {firstName}", plan='free', onboarding_step='profile')
 * 3. organization_members row (role='owner')
 *
 * Se `inviteToken` é passado e válido (não expirado, not used), pre-popula
 * role/state/city da org a partir do waitlist linked e marca token como
 * usado. Token inválido NÃO bloqueia signup — só não pre-popula.
 */

export interface CreateUserWithOrgInput {
  email: string;
  name: string;
  passwordHash: string;
  inviteToken?: string;
}

export interface CreateUserWithOrgResult {
  user: {
    id: string;
    email: string;
    name: string | null;
  };
  organization: {
    id: string;
    name: string;
    plan: string;
    onboardingStep: string;
  };
  member: {
    id: string;
    role: 'owner' | 'admin' | 'member';
  };
  /** True se inviteToken foi consumido com sucesso. */
  invitePrefilled: boolean;
}

export class SignupError extends Error {
  constructor(public readonly code: SignupErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'SignupError';
  }
}

/**
 * Mapeia o role do waitlist pro role da org. São o mesmo enum, mas
 * isolamos a conversão pra resiliência se um dia divergirem.
 */
function syncRole(waitlistRole: WaitlistRoleValue | null): string | null {
  return waitlistRole ?? null;
}

/**
 * Extrai primeiro nome pra montar "Org de {firstName}". Trim + split
 * por whitespace. Fallback "Minha org" se nome vazio (não deve acontecer
 * pq o schema exige min 2 chars, mas defesa em profundidade).
 */
export function defaultOrgName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return 'Minha org';
  const firstName = trimmed.split(/\s+/)[0];
  return `Org de ${firstName}`;
}

interface ResolvedInvite {
  waitlistId: string;
  role: WaitlistRoleValue | null;
  state: string | null;
  city: string | null;
}

/**
 * Valida o invite token dentro da transação. Marca como usado imediatamente
 * (single-use). Retorna `null` se inválido — caller decide se bloqueia ou
 * só ignora.
 *
 * Regras de validez:
 * - existe no DB
 * - `used_at IS NULL`
 * - `expires_at > now()`
 */
async function consumeInviteToken(
  tx: Parameters<Parameters<Db['transaction']>[0]>[0],
  token: string,
  now: Date,
): Promise<ResolvedInvite | null> {
  const rows = await tx
    .select({
      token: inviteTokens.token,
      waitlistId: inviteTokens.waitlistId,
    })
    .from(inviteTokens)
    .where(
      and(
        eq(inviteTokens.token, token),
        isNull(inviteTokens.usedAt),
        gt(inviteTokens.expiresAt, now),
      ),
    )
    .limit(1);

  const inviteRow = rows[0];
  if (!inviteRow || !inviteRow.waitlistId) return null;

  // Atomic mark-as-used. Race-safe: condição WHERE inclui used_at IS NULL.
  const updated = await tx
    .update(inviteTokens)
    .set({ usedAt: now })
    .where(and(eq(inviteTokens.token, token), isNull(inviteTokens.usedAt)))
    .returning({ token: inviteTokens.token });

  if (updated.length === 0) {
    // Outra transação consumiu o token entre o SELECT e o UPDATE.
    return null;
  }

  const waitlistRows = await tx
    .select({
      id: waitlist.id,
      role: waitlist.role,
      state: waitlist.state,
      city: waitlist.city,
    })
    .from(waitlist)
    .where(eq(waitlist.id, inviteRow.waitlistId))
    .limit(1);

  const waitlistRow = waitlistRows[0];
  if (!waitlistRow) return null;

  return {
    waitlistId: waitlistRow.id,
    role: waitlistRow.role,
    state: waitlistRow.state,
    city: waitlistRow.city,
  };
}

/**
 * Detecta violação de UNIQUE(email) no postgres. Drizzle bubblea a
 * PostgresError com `code === '23505'`. Constraint name varia conforme
 * a migration; identificamos pelo column name ou table.
 */
function isEmailUniqueViolation(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { code?: string; constraint_name?: string; detail?: string };
  if (e.code !== '23505') return false;
  const detail = e.detail ?? '';
  return /email/i.test(detail) || /users_email/i.test(e.constraint_name ?? '');
}

/**
 * Função pública. Caller (POST /api/auth/signup — Story 8.1) é responsável
 * pelo hash da senha (argon2) antes de chamar aqui.
 */
export async function createUserWithOrg(
  input: CreateUserWithOrgInput,
  database: Db = db,
): Promise<CreateUserWithOrgResult> {
  const now = new Date();
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();
  const orgName = defaultOrgName(name);

  try {
    return await database.transaction(async (tx) => {
      const insertedUsers = await tx
        .insert(users)
        .values({
          email,
          passwordHash: input.passwordHash,
          name,
          role: 'admin',
        })
        .returning({ id: users.id, email: users.email, name: users.name });

      const user = insertedUsers[0];
      if (!user) {
        throw new SignupError('INTERNAL_ERROR', 'user insert returned no row');
      }

      let invite: ResolvedInvite | null = null;
      if (input.inviteToken) {
        invite = await consumeInviteToken(tx, input.inviteToken, now);
        // Token inválido NÃO bloqueia signup — apenas não pre-popula.
        // (decisão fechada AC #4: INVITE_INVALID é informacional)
      }

      const insertedOrgs = await tx
        .insert(organizations)
        .values({
          name: orgName,
          plan: 'free',
          onboardingStep: 'profile',
          role: syncRole(invite?.role ?? null),
          state: invite?.state ?? null,
          city: invite?.city ?? null,
          waitlistId: invite?.waitlistId ?? null,
        })
        .returning({
          id: organizations.id,
          name: organizations.name,
          plan: organizations.plan,
          onboardingStep: organizations.onboardingStep,
        });

      const organization = insertedOrgs[0];
      if (!organization) {
        throw new SignupError('INTERNAL_ERROR', 'org insert returned no row');
      }

      const insertedMembers = await tx
        .insert(organizationMembers)
        .values({
          organizationId: organization.id,
          userId: user.id,
          role: 'owner',
        })
        .returning({ id: organizationMembers.id, role: organizationMembers.role });

      const member = insertedMembers[0];
      if (!member) {
        throw new SignupError('INTERNAL_ERROR', 'member insert returned no row');
      }

      // Se waitlist convertido, marca status na waitlist row (best effort —
      // não bloqueia signup se a coluna não existir por algum motivo).
      if (invite?.waitlistId) {
        await tx
          .update(waitlist)
          .set({ status: 'converted' })
          .where(eq(waitlist.id, invite.waitlistId));
      }

      logger.info(
        { userId: user.id, orgId: organization.id, invitePrefilled: invite !== null },
        'signup.success',
      );

      return {
        user,
        organization,
        member,
        invitePrefilled: invite !== null,
      };
    });
  } catch (err) {
    if (err instanceof SignupError) {
      logger.error({ code: err.code }, 'signup.error');
      throw err;
    }
    if (isEmailUniqueViolation(err)) {
      logger.warn({ code: 'EMAIL_EXISTS' }, 'signup.error');
      throw new SignupError('EMAIL_EXISTS');
    }
    logger.error(
      { code: 'INTERNAL_ERROR', err: err instanceof Error ? err.message : String(err) },
      'signup.error',
    );
    throw new SignupError('INTERNAL_ERROR');
  }
}

/**
 * Helper utilizado em jobs de manutenção (Story 8.9) pra limpar tokens
 * expirados não utilizados. Não roda em runtime do signup mas é exposto
 * pra reuso futuro.
 */
export async function pruneExpiredInviteTokens(
  database: Db = db,
  now: Date = new Date(),
): Promise<number> {
  const deleted = await database
    .delete(inviteTokens)
    .where(and(isNull(inviteTokens.usedAt), lt(inviteTokens.expiresAt, now)))
    .returning({ token: inviteTokens.token });
  return deleted.length;
}
