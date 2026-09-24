import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';
import { signRealtimeToken } from '@printstudio/shared';

/**
 * /api/stats e /api/printers/:id/temperatures são chamadas direto pelo
 * browser. Exigem o token do web e só enxergam impressoras da org dele —
 * a posse vem de `printers`, não do organization_id das tabelas de
 * telemetria (que o bridge-relay não grava).
 */

const OWN = '11111111-1111-4111-8111-111111111111';
const FOREIGN = '22222222-2222-4222-8222-222222222222';

const executed: SQL[] = [];

vi.mock('../db.js', () => {
  const chain = {
    from: () => chain,
    where: () => chain,
    groupBy: () => chain,
    orderBy: async () => [],
  };
  return {
    db: {
      select: () => chain,
      execute: async (q: SQL) => {
        executed.push(q);
        return [];
      },
    },
  };
});

vi.mock('../middleware/realtime-auth.js', async (importOriginal) => {
  const real = await importOriginal<typeof import('../middleware/realtime-auth.js')>();
  return {
    ...real,
    filterOrgPrinterIds: vi.fn(async (_org: string, ids: readonly string[]) =>
      ids.filter((id) => id === OWN),
    ),
  };
});

const { registerJobRoutes } = await import('./jobs.js');
const { registerPrinterRoutes } = await import('./printers.js');

let app: FastifyInstance;

beforeEach(async () => {
  executed.length = 0;
  app = Fastify();
  await registerJobRoutes(app);
  await registerPrinterRoutes(app);
  await app.ready();
});

afterEach(async () => {
  await app.close();
});

async function bearer(org = 'org-a') {
  const { token } = await signRealtimeToken(process.env.AUTH_SECRET!, { sub: 'user-1', org });
  return { authorization: `Bearer ${token}` };
}

describe('GET /api/stats', () => {
  it('401 sem token', async () => {
    const r = await app.inject({ method: 'GET', url: '/api/stats' });
    expect(r.statusCode).toBe(401);
    expect(executed).toHaveLength(0);
  });

  it('401 com token forjado', async () => {
    const r = await app.inject({
      method: 'GET',
      url: '/api/stats',
      headers: { authorization: 'Bearer abc.def' },
    });
    expect(r.statusCode).toBe(401);
  });

  it('sem printerId agrega só as impressoras da org do token', async () => {
    const r = await app.inject({
      method: 'GET',
      url: '/api/stats',
      headers: await bearer('org-a'),
    });
    expect(r.statusCode).toBe(200);
    const q = new PgDialect().sqlToQuery(executed[0]!);
    expect(q.sql).toMatch(/printer_id IN \(SELECT id FROM printers WHERE organization_id = \$\d\)/);
    expect(q.params).toContain('org-a');
  });
});

describe('GET /api/printers/:id/temperatures', () => {
  it('401 sem token', async () => {
    const r = await app.inject({ method: 'GET', url: `/api/printers/${OWN}/temperatures` });
    expect(r.statusCode).toBe(401);
  });

  it('404 pra impressora de outra org', async () => {
    const r = await app.inject({
      method: 'GET',
      url: `/api/printers/${FOREIGN}/temperatures`,
      headers: await bearer(),
    });
    expect(r.statusCode).toBe(404);
  });

  it('200 pra impressora da própria org', async () => {
    const r = await app.inject({
      method: 'GET',
      url: `/api/printers/${OWN}/temperatures`,
      headers: await bearer(),
    });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toMatchObject({ hours: 24, points: [] });
  });
});
