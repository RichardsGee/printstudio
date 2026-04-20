import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { and, desc, eq, type SQL } from 'drizzle-orm';
import { printJobs } from '@printstudio/db';
import { db } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const QuerySchema = z.object({
  printerId: z.string().uuid().optional(),
  status: z.enum(['RUNNING', 'SUCCESS', 'FAILED', 'CANCELLED']).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(50),
});

export async function registerJobRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/jobs', { preHandler: requireAuth }, async (req, reply) => {
    const parse = QuerySchema.safeParse(req.query);
    if (!parse.success) {
      return reply.code(400).send({ error: 'invalid query', issues: parse.error.issues });
    }
    const { printerId, status, limit } = parse.data;

    const filters: SQL[] = [];
    if (printerId) filters.push(eq(printJobs.printerId, printerId));
    if (status) filters.push(eq(printJobs.status, status));

    const where = filters.length ? and(...filters) : undefined;

    return db
      .select()
      .from(printJobs)
      .where(where)
      .orderBy(desc(printJobs.startedAt))
      .limit(limit);
  });
}
