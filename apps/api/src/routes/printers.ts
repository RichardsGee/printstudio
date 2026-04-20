import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { printers, printerState } from '@printstudio/db';
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
