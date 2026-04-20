import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { and, desc, eq, sql, type SQL } from 'drizzle-orm';
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

  /**
   * Estatísticas agregadas — lifetime ou filtradas por printer.
   * Retorna contagens, taxa de sucesso, tempo total e histograma por
   * hora do dia (pra detectar horários de pico de falhas).
   */
  app.get('/api/stats', async (req, reply) => {
    const q = z
      .object({ printerId: z.string().uuid().optional() })
      .safeParse(req.query);
    if (!q.success) return reply.code(400).send({ error: 'invalid query' });

    const pidFilter = q.data.printerId
      ? sql`WHERE printer_id = ${q.data.printerId}`
      : sql``;

    // Agrega tudo numa query só pra manter leve.
    const rows = await db.execute<{
      total_jobs: number;
      success: number;
      failed: number;
      cancelled: number;
      running: number;
      total_duration_sec: number;
      avg_duration_sec: number;
    }>(sql`
      SELECT
        COUNT(*)::int AS total_jobs,
        COUNT(*) FILTER (WHERE status = 'SUCCESS')::int AS success,
        COUNT(*) FILTER (WHERE status = 'FAILED')::int AS failed,
        COUNT(*) FILTER (WHERE status = 'CANCELLED')::int AS cancelled,
        COUNT(*) FILTER (WHERE status = 'RUNNING')::int AS running,
        COALESCE(SUM(duration_sec), 0)::int AS total_duration_sec,
        COALESCE(AVG(duration_sec) FILTER (WHERE status = 'SUCCESS'), 0)::int AS avg_duration_sec
      FROM print_jobs
      ${pidFilter}
    `);

    const agg = rows[0] ?? {
      total_jobs: 0,
      success: 0,
      failed: 0,
      cancelled: 0,
      running: 0,
      total_duration_sec: 0,
      avg_duration_sec: 0,
    };

    // Histograma de falhas por hora do dia (0..23).
    const failures = await db.execute<{ hour: number; count: number }>(sql`
      SELECT
        EXTRACT(HOUR FROM started_at)::int AS hour,
        COUNT(*)::int AS count
      FROM print_jobs
      WHERE status = 'FAILED' ${q.data.printerId ? sql`AND printer_id = ${q.data.printerId}` : sql``}
      GROUP BY 1
      ORDER BY 1
    `);

    const finishedCount = agg.success + agg.failed;
    const successRate = finishedCount > 0 ? agg.success / finishedCount : null;

    return {
      totalJobs: agg.total_jobs,
      success: agg.success,
      failed: agg.failed,
      cancelled: agg.cancelled,
      running: agg.running,
      successRate,
      totalDurationSec: agg.total_duration_sec,
      avgDurationSec: agg.avg_duration_sec,
      failuresByHour: failures.map((r) => ({ hour: Number(r.hour), count: Number(r.count) })),
    };
  });
}
