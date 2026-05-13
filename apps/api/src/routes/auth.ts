import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import argon2 from 'argon2';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';
import { inviteTokens, sessions, users, waitlist } from '@printstudio/db';
import { SignupSchema, type SignupErrorCode } from '@printstudio/shared';
import { db } from '../db.js';
import { config } from '../config.js';
import { requireAuth, SESSION_COOKIE } from '../middleware/auth.js';
import { createUserWithOrg, SignupError } from '../services/signup.js';

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30d

function makeSessionId(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Rate limit em memória pro signup (5/IP/hora). Memory-based pq:
 * - Persistir IPs em DB pra contar requer migration nova
 * - V1 roda 1 instância EasyPanel, cache em memory é suficiente
 * - V2 com múltiplas instâncias migra pra Redis
 *
 * Cleanup roda a cada 5 min removendo entradas com idade > 1h.
 */
const SIGNUP_RATE_LIMIT_MAX = 5;
const SIGNUP_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const signupAttempts = new Map<string, number[]>();
setInterval(() => {
  const now = Date.now();
  for (const [ip, timestamps] of signupAttempts.entries()) {
    const fresh = timestamps.filter((t) => now - t < SIGNUP_RATE_LIMIT_WINDOW_MS);
    if (fresh.length === 0) signupAttempts.delete(ip);
    else signupAttempts.set(ip, fresh);
  }
}, 5 * 60 * 1000).unref();

function checkSignupRateLimit(ip: string | null): boolean {
  if (!ip) return true; // sem IP, não conta (fail open — dev local sem proxy)
  const now = Date.now();
  const existing = signupAttempts.get(ip) ?? [];
  const fresh = existing.filter((t) => now - t < SIGNUP_RATE_LIMIT_WINDOW_MS);
  if (fresh.length >= SIGNUP_RATE_LIMIT_MAX) {
    return false;
  }
  fresh.push(now);
  signupAttempts.set(ip, fresh);
  return true;
}

/**
 * Extrai IP do request seguindo padrão Story 7.3 (X-Forwarded-For
 * primeiro, X-Real-IP fallback, req.ip último).
 */
function extractIp(req: FastifyRequest): string | null {
  const xff = req.headers['x-forwarded-for'];
  if (xff) {
    const first = (Array.isArray(xff) ? xff[0] : xff).split(',')[0]?.trim();
    if (first) return first;
  }
  const xRealIp = req.headers['x-real-ip'];
  if (xRealIp) {
    return (Array.isArray(xRealIp) ? xRealIp[0] : xRealIp).trim();
  }
  return req.ip ?? null;
}

/**
 * Map error codes do service → HTTP status pra response API.
 */
function statusForSignupError(code: SignupErrorCode): number {
  switch (code) {
    case 'EMAIL_EXISTS':
      return 409;
    case 'INVALID_PAYLOAD':
      return 400;
    case 'RATE_LIMITED':
      return 429;
    case 'INVITE_INVALID':
    case 'INTERNAL_ERROR':
    default:
      return 500;
  }
}

function sendSignupError(
  reply: FastifyReply,
  code: SignupErrorCode,
  message: string,
  field?: string,
): FastifyReply {
  return reply.code(statusForSignupError(code)).send({
    error: { code, message, ...(field ? { field } : {}) },
  });
}

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/auth/login', async (req, reply) => {
    const parse = LoginSchema.safeParse(req.body);
    if (!parse.success) {
      return reply.code(400).send({ error: 'invalid body' });
    }

    const rows = await db
      .select()
      .from(users)
      .where(eq(users.email, parse.data.email))
      .limit(1);
    const user = rows[0];

    // WHY: verify against a dummy hash on unknown email to avoid timing oracle.
    const hashToCheck = user?.passwordHash ?? '$argon2id$v=19$m=65536,t=3,p=4$dGVzdA$dummy';
    let valid = false;
    try {
      valid = await argon2.verify(hashToCheck, parse.data.password);
    } catch {
      valid = false;
    }

    if (!user || !valid) {
      return reply.code(401).send({ error: 'invalid credentials' });
    }

    const sessionId = makeSessionId();
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    await db.insert(sessions).values({ id: sessionId, userId: user.id, expiresAt });

    return reply
      .setCookie(SESSION_COOKIE, sessionId, {
        httpOnly: true,
        sameSite: 'lax',
        secure: config.NODE_ENV === 'production',
        path: '/',
        expires: expiresAt,
      })
      .send({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      });
  });

  app.post('/api/auth/logout', async (req, reply) => {
    const sessionId = req.cookies[SESSION_COOKIE];
    if (sessionId) {
      await db.delete(sessions).where(eq(sessions.id, sessionId));
    }
    return reply
      .clearCookie(SESSION_COOKIE, { path: '/' })
      .code(204)
      .send();
  });

  app.get('/api/auth/me', { preHandler: requireAuth }, async (req) => {
    const u = req.user!;
    return {
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
    };
  });

  /**
   * POST /api/auth/signup — Story 8.1
   *
   * Cria user + org + member atomicamente via service createUserWithOrg
   * (Story 8.2). Set session cookie em sucesso pra usuário já estar
   * autenticado quando UI redirecionar pra /onboarding/profile.
   *
   * Honeypot + rate limit (5/IP/hora) protegem contra abuso.
   */
  app.post('/api/auth/signup', async (req, reply) => {
    const startedAt = Date.now();
    const ip = extractIp(req);

    // 1. Valida payload (shared schema com client)
    const parsed = SignupSchema.safeParse(req.body);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      return sendSignupError(
        reply,
        'INVALID_PAYLOAD',
        firstIssue?.message ?? 'Payload inválido',
        firstIssue?.path.join('.'),
      );
    }
    const data = parsed.data;

    // 2. Honeypot — bot detectado → 200 fake silencioso (mesma estratégia
    // do waitlist Story 7.3 pra não dar pistas pro bot)
    if (data.website && data.website.length > 0) {
      app.log.info({ event: 'signup.bot_detected', ip }, 'honeypot triggered');
      return reply.code(200).send({
        ok: true,
        user: { id: '00000000-0000-0000-0000-000000000000', email: data.email, name: data.name },
        organization: { id: '00000000-0000-0000-0000-000000000000', name: 'fake', onboardingStep: 'profile' },
      });
    }

    // 3. Rate limit por IP
    if (!checkSignupRateLimit(ip)) {
      app.log.warn({ event: 'signup.rate_limited', ip }, 'rate limit exceeded');
      return sendSignupError(
        reply,
        'RATE_LIMITED',
        'Muitas tentativas do mesmo IP. Tente novamente em 1 hora.',
      );
    }

    // 4. Hash senha com argon2 (já no projeto, padrão do login endpoint)
    let passwordHash: string;
    try {
      passwordHash = await argon2.hash(data.password, { type: argon2.argon2id });
    } catch (err) {
      app.log.error(
        { event: 'signup.hash_error', err: (err as Error).message },
        'argon2 hash failed',
      );
      return sendSignupError(reply, 'INTERNAL_ERROR', 'Erro interno. Tente novamente.');
    }

    // 5. Chama service transação atômica
    try {
      const result = await createUserWithOrg({
        email: data.email,
        name: data.name,
        passwordHash,
        inviteToken: data.inviteToken,
      });

      // 6. Cria session row + set cookie (autologin pós-signup)
      const sessionId = makeSessionId();
      const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
      await db.insert(sessions).values({
        id: sessionId,
        userId: result.user.id,
        expiresAt,
      });

      const duration = Date.now() - startedAt;
      app.log.info(
        {
          event: 'signup.success',
          userId: result.user.id,
          orgId: result.organization.id,
          invitePrefilled: result.invitePrefilled,
          duration_ms: duration,
        },
        'signup ok',
      );

      return reply
        .setCookie(SESSION_COOKIE, sessionId, {
          httpOnly: true,
          sameSite: 'lax',
          secure: config.NODE_ENV === 'production',
          path: '/',
          expires: expiresAt,
        })
        .code(201)
        .send({
          ok: true,
          user: result.user,
          organization: result.organization,
        });
    } catch (err) {
      if (err instanceof SignupError) {
        const userMessage =
          err.code === 'EMAIL_EXISTS'
            ? 'Esse email já tem conta. Faça login.'
            : 'Erro interno. Tente novamente.';
        return sendSignupError(reply, err.code, userMessage);
      }
      app.log.error(
        { event: 'signup.unhandled', err: (err as Error).message },
        'unhandled signup error',
      );
      return sendSignupError(reply, 'INTERNAL_ERROR', 'Erro interno. Tente novamente.');
    }
  });

  /**
   * GET /api/public/invite/:token — Story 8.1 (pre-fill da página /signup)
   *
   * Resolve um invite token e retorna apenas name+email do waitlist
   * linked se o token for válido (não expirado, não usado). Endpoint
   * público (sem auth) — usado pelo Server Component da `/signup` page.
   *
   * Não consome o token — só consulta. O consume acontece no momento
   * do signup real (transação do service createUserWithOrg).
   */
  app.get<{ Params: { token: string } }>(
    '/api/public/invite/:token',
    async (req, reply) => {
      const token = req.params.token;
      if (!token || token.length > 200) {
        return reply.code(404).send({ error: { code: 'INVITE_INVALID' } });
      }

      const now = new Date();
      const rows = await db
        .select({
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

      const tokenRow = rows[0];
      if (!tokenRow?.waitlistId) {
        return reply.code(404).send({ error: { code: 'INVITE_INVALID' } });
      }

      const waitlistRows = await db
        .select({ name: waitlist.name, email: waitlist.email })
        .from(waitlist)
        .where(eq(waitlist.id, tokenRow.waitlistId))
        .limit(1);

      const waitlistRow = waitlistRows[0];
      if (!waitlistRow) {
        return reply.code(404).send({ error: { code: 'INVITE_INVALID' } });
      }

      return reply.send({
        ok: true,
        prefill: {
          name: waitlistRow.name,
          email: waitlistRow.email,
        },
      });
    },
  );
}
