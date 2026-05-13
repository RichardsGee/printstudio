import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { users } from '@printstudio/db';
import { db } from '../db.js';
import { logger } from '../logger.js';
import { requireAuth } from '../middleware/auth.js';

const IdParamSchema = z.object({ id: z.string().uuid() });

/**
 * Schema do PATCH /api/users/:id (Story 9.1).
 *
 * **Defesa profundidade contra privilege escalation:**
 * `.strict()` rejeita qualquer campo extra (incluindo `is_super_admin`)
 * — Zod retorna issue, response 400.
 *
 * Validamos também a presença do flag no raw body antes do parse, pra
 * conseguir logar tentativas explícitas. O `.strict()` cobre o ataque,
 * o pre-check só é pra auditoria.
 */
const UpdateUserSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    notificationChannels: z
      .object({
        telegramChatId: z.string().max(200).optional(),
        email: z.string().email().max(200).optional(),
      })
      .optional(),
  })
  .strict();

/** Campos que NUNCA podem vir num PATCH normal. Centralizados pra auditoria. */
const FORBIDDEN_FIELDS = new Set([
  'isSuperAdmin',
  'is_super_admin',
  'passwordHash',
  'password_hash',
  'role',
  'email',
  'id',
]);

export async function registerUserRoutes(app: FastifyInstance): Promise<void> {
  /**
   * PATCH /api/users/:id — atualiza campos seguros do user.
   *
   * Regras:
   * - User só pode patchar a si mesmo (ownership)
   * - Strict Zod rejeita campos não-listados
   * - Tentativa explícita de setar `is_super_admin` é logada como warn
   *   (auditoria) ANTES de Zod rejeitar
   *
   * Super-admin NUNCA é editável via API normal. Promoção é manual via
   * SQL `UPDATE users SET is_super_admin = true WHERE email = '...'`
   * (docs/architecture/admin-setup.md).
   */
  app.patch<{ Params: { id: string } }>(
    '/api/users/:id',
    { preHandler: requireAuth },
    async (req, reply) => {
      const idParse = IdParamSchema.safeParse(req.params);
      if (!idParse.success) {
        return reply.code(400).send({ error: { code: 'INVALID_ID' } });
      }

      const targetUserId = idParse.data.id;
      const currentUserId = req.user!.id;

      // Ownership: user só pode patchar a si próprio. Admin Panel
      // (Story 9.5) eventualmente vai expor PATCH a super-admins
      // via outro endpoint dedicado.
      if (targetUserId !== currentUserId) {
        return reply.code(403).send({ error: { code: 'FORBIDDEN' } });
      }

      // Auditoria de tentativa de escalation — ANTES do strict parse
      const rawBody = (req.body ?? {}) as Record<string, unknown>;
      const attemptedForbidden: string[] = [];
      for (const key of Object.keys(rawBody)) {
        if (FORBIDDEN_FIELDS.has(key)) attemptedForbidden.push(key);
      }
      if (attemptedForbidden.length > 0) {
        logger.warn(
          {
            event: 'users.escalation_attempt',
            userId: currentUserId,
            attemptedFields: attemptedForbidden,
            ip: req.ip,
          },
          'attempt to set privileged field via user PATCH',
        );
      }

      // Strict parse rejeita TODOS os campos não permitidos, incluindo
      // isSuperAdmin/role/passwordHash/email/id. Mesmo que pre-check
      // acima não pegue algum nome alternativo, .strict() pega.
      const parsed = UpdateUserSchema.safeParse(rawBody);
      if (!parsed.success) {
        return reply.code(400).send({
          error: {
            code: 'INVALID_PAYLOAD',
            message: parsed.error.issues[0]?.message ?? 'Payload inválido',
            field: parsed.error.issues[0]?.path[0]?.toString(),
          },
        });
      }

      // Nada pra atualizar — request válido mas vazio
      const updateData: Record<string, unknown> = {};
      if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
      if (parsed.data.notificationChannels !== undefined) {
        updateData.notificationChannels = parsed.data.notificationChannels;
      }
      if (Object.keys(updateData).length === 0) {
        return reply.code(400).send({
          error: { code: 'INVALID_PAYLOAD', message: 'Nada pra atualizar' },
        });
      }

      const [updated] = await db
        .update(users)
        .set(updateData)
        .where(eq(users.id, targetUserId))
        .returning({
          id: users.id,
          email: users.email,
          name: users.name,
          role: users.role,
        });

      if (!updated) {
        return reply.code(404).send({ error: { code: 'NOT_FOUND' } });
      }

      return reply.send({ ok: true, user: updated });
    },
  );
}
