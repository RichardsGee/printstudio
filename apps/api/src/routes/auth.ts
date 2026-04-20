import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import argon2 from 'argon2';
import { eq } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';
import { users, sessions } from '@printstudio/db';
import { db } from '../db.js';
import { config } from '../config.js';
import { requireAuth, SESSION_COOKIE } from '../middleware/auth.js';

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30d

function makeSessionId(): string {
  return randomBytes(32).toString('hex');
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
}
