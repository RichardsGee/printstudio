import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq } from 'drizzle-orm';
import { sessions, users, type User, type Session } from '@printstudio/db';
import { db } from '../db.js';

declare module 'fastify' {
  interface FastifyRequest {
    user?: User;
    session?: Session;
  }
}

export const SESSION_COOKIE = 'sessionId';

export async function loadSession(sessionId: string): Promise<{ user: User; session: Session } | null> {
  const rows = await db
    .select({ user: users, session: sessions })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(eq(sessions.id, sessionId))
    .limit(1);

  const row = rows[0];
  if (!row) return null;
  if (row.session.expiresAt.getTime() < Date.now()) return null;
  return row;
}

export async function requireAuth(
  req: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const sessionId = req.cookies[SESSION_COOKIE];
  if (!sessionId) {
    return reply.code(401).send({ error: 'unauthorized' });
  }

  const result = await loadSession(sessionId);
  if (!result) {
    return reply.code(401).send({ error: 'unauthorized' });
  }

  req.user = result.user;
  req.session = result.session;
}

export async function requireAdmin(
  req: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  await requireAuth(req, reply);
  if (reply.sent) return;
  if (req.user?.role !== 'admin') {
    return reply.code(403).send({ error: 'forbidden' });
  }
}
