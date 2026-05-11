/**
 * Rotas pro fluxo "Conectar conta Bambu Cloud" (Story 4.4).
 *
 *   POST /api/bambu/send-code     — pede código por email
 *   POST /api/bambu/verify-code   — login + persist credenciais
 *
 * Ambas exigem auth (user logado). A organização usada é a primária do
 * user (MVP: cada user tem 1 org). No futuro, request poderá receber
 * um header com organizationId explícito.
 */

import type { FastifyInstance } from 'fastify';
import { and, eq, sql } from 'drizzle-orm';
import {
  BambuSendCodeRequestSchema,
  BambuVerifyCodeRequestSchema,
  type BambuDevice,
  type BambuErrorCode,
  type BambuVerifyCodeResponse,
} from '@printstudio/shared';
import {
  bambuCredentials,
  organizationMembers,
  encrypt,
  parseKey,
} from '@printstudio/db';
import { db } from '../db.js';
import { config } from '../config.js';
import { logger } from '../logger.js';
import { requireAuth } from '../middleware/auth.js';
import {
  sendEmailCode,
  loginWithCode,
  listDevices,
  getUserId,
  BambuCloudError,
} from '../services/bambu-cloud.js';

function errorPayload(code: BambuErrorCode, message: string) {
  return { error: { code, message } };
}

async function resolveUserOrganizationId(userId: string): Promise<string | null> {
  const rows = await db
    .select({ orgId: organizationMembers.organizationId })
    .from(organizationMembers)
    .where(eq(organizationMembers.userId, userId))
    .limit(1);
  return rows[0]?.orgId ?? null;
}

export async function registerBambuRoutes(app: FastifyInstance): Promise<void> {
  const credKey = parseKey(config.BAMBU_CRED_KEY);

  app.post(
    '/api/bambu/send-code',
    { preHandler: requireAuth },
    async (req, reply) => {
      const parsed = BambuSendCodeRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send(errorPayload('INTERNAL_ERROR', 'Email inválido'));
      }
      try {
        await sendEmailCode(parsed.data.email);
        return reply.code(204).send();
      } catch (err) {
        if (err instanceof BambuCloudError) {
          logger.warn({ code: err.code, email: parsed.data.email }, 'send-code falhou');
          return reply.code(502).send(errorPayload(err.code, err.message));
        }
        logger.error({ err }, 'send-code unexpected error');
        return reply.code(500).send(errorPayload('INTERNAL_ERROR', 'Erro interno'));
      }
    },
  );

  app.post(
    '/api/bambu/verify-code',
    { preHandler: requireAuth },
    async (req, reply) => {
      const parsed = BambuVerifyCodeRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply
          .code(400)
          .send(errorPayload('INTERNAL_ERROR', 'Email ou código inválido'));
      }
      const { email, code } = parsed.data;
      const userId = req.user!.id;

      const organizationId = await resolveUserOrganizationId(userId);
      if (!organizationId) {
        logger.error({ userId }, 'user sem organização — schema multi-tenant inconsistente');
        return reply
          .code(500)
          .send(errorPayload('INTERNAL_ERROR', 'Usuário sem organização'));
      }

      try {
        const { accessToken, refreshToken, expiresIn } = await loginWithCode(email, code);
        const [devices, bambuUserId] = await Promise.all([
          listDevices(accessToken),
          getUserId(accessToken),
        ]);

        const expiresAt = new Date(Date.now() + expiresIn * 1000);
        const encryptedAccess = encrypt(accessToken, credKey);
        const encryptedRefresh = refreshToken ? encrypt(refreshToken, credKey) : null;
        const now = new Date();

        await db
          .insert(bambuCredentials)
          .values({
            organizationId,
            bambuEmail: email,
            bambuUserId,
            encryptedAccessToken: encryptedAccess,
            encryptedRefreshToken: encryptedRefresh,
            accessTokenExpiresAt: expiresAt,
            lastSyncedAt: now,
          })
          .onConflictDoUpdate({
            target: bambuCredentials.organizationId,
            set: {
              bambuEmail: email,
              bambuUserId,
              encryptedAccessToken: encryptedAccess,
              encryptedRefreshToken: encryptedRefresh,
              accessTokenExpiresAt: expiresAt,
              lastSyncedAt: now,
              updatedAt: now,
            },
          });

        const mapped: BambuDevice[] = devices.map((d) => ({
          serial: d.dev_id,
          name: d.name,
          model: d.dev_product_name,
          online: d.online,
        }));

        const response: BambuVerifyCodeResponse = {
          organizationId,
          bambuEmail: email,
          bambuUserId,
          devices: mapped,
        };
        logger.info(
          { organizationId, bambuUserId, deviceCount: mapped.length },
          'bambu credentials saved',
        );
        return reply.send(response);
      } catch (err) {
        if (err instanceof BambuCloudError) {
          logger.warn({ code: err.code, email }, 'verify-code falhou');
          const httpStatus = err.code === 'BAMBU_INVALID_CODE' ? 400 : 502;
          return reply.code(httpStatus).send(errorPayload(err.code, err.message));
        }
        logger.error({ err }, 'verify-code unexpected error');
        return reply.code(500).send(errorPayload('INTERNAL_ERROR', 'Erro interno'));
      }
    },
  );
}

// Silence unused-import linter — `and`/`sql` reservados pra queries futuras
void and;
void sql;
