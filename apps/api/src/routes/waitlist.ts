import type { FastifyInstance } from 'fastify';
import { and, eq, gt, sql } from 'drizzle-orm';
import { waitlist } from '@printstudio/db';
import { BAMBU_COUNT_FROM_RANGE, WaitlistSubmitSchema } from '@printstudio/shared';
import { db } from '../db.js';

/**
 * Endpoint público de cadastro na waitlist (Story 7.3).
 *
 * Características críticas:
 * - **Honeypot:** field `website` invisível no form. Se vier preenchido,
 *   retorna 200 fake sem inserir (bot pensa que deu certo, não tenta de novo).
 * - **Rate limit:** max 3 cadastros / IP / hora → 429.
 * - **UNIQUE email:** retorna 409 amigável.
 * - **CORS:** configurado no server.ts via API_PUBLIC_CORS_ORIGINS.
 *
 * Não requer auth — é o primeiro ponto de contato do visitor.
 */
export async function registerWaitlistRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/public/waitlist', async (req, reply) => {
    const startedAt = Date.now();

    // 1. Valida payload
    const parsed = WaitlistSubmitSchema.safeParse(req.body);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      return reply.code(400).send({
        error: {
          code: 'INVALID_PAYLOAD',
          message: firstIssue?.message ?? 'Payload inválido',
          field: firstIssue?.path.join('.') ?? null,
        },
      });
    }
    const data = parsed.data;

    // 2. Honeypot — bot detectado → 200 fake silencioso
    if (data.website && data.website.length > 0) {
      app.log.info({ event: 'waitlist.bot_detected', ip: extractIp(req) }, 'honeypot triggered');
      // Retorna fake success pra não dar pistas ao bot
      return reply.code(200).send({ ok: true, id: '00000000-0000-0000-0000-000000000000' });
    }

    // 3. Captura metadata
    const ip = extractIp(req);
    const userAgent = (req.headers['user-agent'] ?? '').toString().slice(0, 500);
    const referrer = data.referrer ?? (req.headers['referer'] ?? '').toString().slice(0, 500);

    // 4. Rate limit por IP (3 cadastros / hora)
    if (ip) {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const recent = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(waitlist)
        .where(and(eq(waitlist.ipAddress, ip), gt(waitlist.createdAt, oneHourAgo)));
      const count = recent[0]?.count ?? 0;
      if (count >= 3) {
        app.log.warn({ event: 'waitlist.rate_limited', ip, count }, 'rate limit exceeded');
        return reply.code(429).send({
          error: {
            code: 'RATE_LIMITED',
            message: 'Muitos cadastros do mesmo IP. Tente novamente em 1 hora.',
          },
        });
      }
    }

    // 5. INSERT (UNIQUE email é DB constraint — captura 23505)
    try {
      const [inserted] = await db
        .insert(waitlist)
        .values({
          email: data.email, // já lowercased + trimmed pelo Zod
          name: data.name,
          bambuCount: BAMBU_COUNT_FROM_RANGE[data.bambuCount],
          role: data.role,
          state: data.state ?? null,
          city: data.city ?? null,
          telegramHandle: data.telegramHandle ?? null,
          phone: data.phone ?? null,
          sourceUtm: data.utm ?? null,
          referrer: referrer || null,
          userAgent: userAgent || null,
          ipAddress: ip ?? null,
        })
        .returning({ id: waitlist.id });

      const duration = Date.now() - startedAt;
      app.log.info(
        {
          event: 'waitlist.submitted',
          id: inserted.id,
          ip,
          status: 201,
          duration_ms: duration,
        },
        'waitlist submission ok',
      );

      return reply.code(201).send({
        ok: true,
        id: inserted.id,
      });
    } catch (err: unknown) {
      // Postgres UNIQUE violation
      if (isUniqueViolation(err)) {
        app.log.info({ event: 'waitlist.duplicate', ip }, 'email already exists');
        return reply.code(409).send({
          error: {
            code: 'EMAIL_ALREADY_EXISTS',
            message: 'Você já está na lista, vamos te chamar em breve!',
          },
        });
      }
      const e = err as Error;
      app.log.error({ event: 'waitlist.error', ip, error: e.message }, 'waitlist insert failed');
      return reply.code(500).send({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Erro interno. Tente novamente.',
        },
      });
    }
  });
}

/**
 * Extrai IP do request seguindo ordem definida pela Aria:
 * X-Forwarded-For (primeiro IP) → X-Real-IP → req.ip (socket).
 *
 * EasyPanel está atrás de proxy reverso, então X-Forwarded-For é
 * o primary source.
 */
function extractIp(req: { headers: Record<string, string | string[] | undefined>; ip?: string }): string | null {
  const xff = req.headers['x-forwarded-for'];
  if (xff) {
    // X-Forwarded-For: client, proxy1, proxy2 — pegamos o primeiro
    const first = (Array.isArray(xff) ? xff[0] : xff).split(',')[0]?.trim();
    if (first) return first;
  }
  const xRealIp = req.headers['x-real-ip'];
  if (xRealIp) {
    return (Array.isArray(xRealIp) ? xRealIp[0] : xRealIp).trim();
  }
  return req.ip ?? null;
}

function isUniqueViolation(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const code = (err as { code?: string }).code;
  return code === '23505';
}
