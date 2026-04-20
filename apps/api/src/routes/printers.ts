import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { and, eq, gte, sql } from 'drizzle-orm';
import { printers, printerState, temperatureSamples } from '@printstudio/db';
import { db } from '../db.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const CreatePrinterSchema = z.object({
  name: z.string().min(1),
  serial: z.string().min(1),
  accessCode: z.string().min(1),
  ipAddress: z.string().ip().optional(),
  model: z.string().default('A1'),
});

const UpdatePrinterSchema = CreatePrinterSchema.partial();

const IdParamSchema = z.object({ id: z.string().uuid() });

export async function registerPrinterRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/printers', { preHandler: requireAuth }, async () => {
    const rows = await db
      .select()
      .from(printers)
      .leftJoin(printerState, eq(printers.id, printerState.printerId));
    return rows.map((r) => ({ ...r.printers, state: r.printer_state }));
  });

  app.get('/api/printers/:id', { preHandler: requireAuth }, async (req, reply) => {
    const parse = IdParamSchema.safeParse(req.params);
    if (!parse.success) return reply.code(400).send({ error: 'invalid id' });

    const row = await db
      .select()
      .from(printers)
      .leftJoin(printerState, eq(printers.id, printerState.printerId))
      .where(eq(printers.id, parse.data.id))
      .limit(1);

    const first = row[0];
    if (!first) return reply.code(404).send({ error: 'not found' });
    return { ...first.printers, state: first.printer_state };
  });

  app.post('/api/printers', { preHandler: requireAdmin }, async (req, reply) => {
    const parse = CreatePrinterSchema.safeParse(req.body);
    if (!parse.success) {
      return reply.code(400).send({ error: 'invalid body', issues: parse.error.issues });
    }
    const [created] = await db.insert(printers).values(parse.data).returning();
    return reply.code(201).send(created);
  });

  app.patch('/api/printers/:id', { preHandler: requireAdmin }, async (req, reply) => {
    const idParse = IdParamSchema.safeParse(req.params);
    if (!idParse.success) return reply.code(400).send({ error: 'invalid id' });

    const parse = UpdatePrinterSchema.safeParse(req.body);
    if (!parse.success) {
      return reply.code(400).send({ error: 'invalid body', issues: parse.error.issues });
    }

    const [updated] = await db
      .update(printers)
      .set({ ...parse.data, updatedAt: new Date() })
      .where(eq(printers.id, idParse.data.id))
      .returning();

    if (!updated) return reply.code(404).send({ error: 'not found' });
    return updated;
  });

  /**
   * Histórico de temperaturas com time-bucketing SQL. Retorna no máximo
   * ~300 pontos mesmo pra janelas longas, evitando payload pesado.
   */
  // Sem auth gate no MVP — consistente com /ws/client, e o LAN
  // bridge é o único que popula esses dados.
  app.get(
    '/api/printers/:id/temperatures',
    async (req, reply) => {
      const parse = IdParamSchema.safeParse(req.params);
      if (!parse.success) return reply.code(400).send({ error: 'invalid id' });

      const q = z
        .object({ hours: z.coerce.number().int().min(1).max(168).default(24) })
        .safeParse(req.query);
      if (!q.success) return reply.code(400).send({ error: 'invalid query' });

      const hoursBack = q.data.hours;
      const since = new Date(Date.now() - hoursBack * 3_600_000);
      // Bucket size: 24h → 5min, 168h → ~35min. Sempre ~288 pontos.
      const bucketSec = Math.max(60, Math.round((hoursBack * 3600) / 288));

      const rows = await db
        .select({
          bucket: sql<string>`date_bin(${sql.raw(`interval '${bucketSec} seconds'`)}, ${temperatureSamples.recordedAt}, timestamptz 'epoch')`.as('bucket'),
          nozzleAvg: sql<number>`avg(${temperatureSamples.nozzleTemp})`.as('nozzle_avg'),
          bedAvg: sql<number>`avg(${temperatureSamples.bedTemp})`.as('bed_avg'),
          chamberAvg: sql<number>`avg(${temperatureSamples.chamberTemp})`.as('chamber_avg'),
        })
        .from(temperatureSamples)
        .where(
          and(
            eq(temperatureSamples.printerId, parse.data.id),
            gte(temperatureSamples.recordedAt, since),
          ),
        )
        .groupBy(sql`bucket`)
        .orderBy(sql`bucket`);

      return {
        hours: hoursBack,
        bucketSec,
        points: rows.map((r) => ({
          t: r.bucket,
          nozzle: r.nozzleAvg != null ? Number(r.nozzleAvg) : null,
          bed: r.bedAvg != null ? Number(r.bedAvg) : null,
          chamber: r.chamberAvg != null ? Number(r.chamberAvg) : null,
        })),
      };
    },
  );

  app.delete('/api/printers/:id', { preHandler: requireAdmin }, async (req, reply) => {
    const parse = IdParamSchema.safeParse(req.params);
    if (!parse.success) return reply.code(400).send({ error: 'invalid id' });

    const [deleted] = await db
      .delete(printers)
      .where(eq(printers.id, parse.data.id))
      .returning({ id: printers.id });

    if (!deleted) return reply.code(404).send({ error: 'not found' });
    return reply.code(204).send();
  });
}
