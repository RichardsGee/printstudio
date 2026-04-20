import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { and, desc, eq, type SQL } from 'drizzle-orm';
import { events } from '@printstudio/db';
import { db } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const QuerySchema = z.object({
  printerId: z.string().uuid().optional(),
  type: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});

export async function registerEventRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/events', { preHandler: requireAuth }, async (req, reply) => {
    const parse = QuerySchema.safeParse(req.query);
    if (!parse.success) {
      return reply.code(400).send({ error: 'invalid query', issues: parse.error.issues });
    }
    const { printerId, type, limit } = parse.data;

    const filters: SQL[] = [];
    if (printerId) filters.push(eq(events.printerId, printerId));
    if (type) filters.push(eq(events.type, type));

    const where = filters.length ? and(...filters) : undefined;

    return db
      .select()
      .from(events)
      .where(where)
      .orderBy(desc(events.createdAt))
      .limit(limit);
  });
}
