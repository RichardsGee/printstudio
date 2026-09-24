import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import websocket from '@fastify/websocket';
import { signRealtimeToken } from '@printstudio/shared';

/**
 * O /ws/client autoriza pelo token do web e escopa pela organização:
 * sem token não conecta; subscribe e command só valem pra impressoras
 * da org do token. Banco e bridge são mocks.
 */

const OWN = '11111111-1111-4111-8111-111111111111';
const FOREIGN = '22222222-2222-4222-8222-222222222222';

vi.mock('../db.js', () => {
  // loadSnapshot: db.select().from().where() → sem linhas.
  const chain = { from: () => chain, where: async () => [] };
  return { db: { select: () => chain } };
});

vi.mock('../middleware/realtime-auth.js', () => ({
  filterOrgPrinterIds: vi.fn(async (_org: string, ids: readonly string[]) =>
    ids.filter((id) => id === OWN),
  ),
}));

const { hub } = await import('./hub.js');
const { registerClientRelay } = await import('./client-relay.js');

let app: FastifyInstance;

beforeEach(async () => {
  app = Fastify();
  await app.register(websocket);
  await registerClientRelay(app);
  await app.ready();
});

afterEach(async () => {
  vi.restoreAllMocks();
  await app.close();
});

async function tokenFor(org: string) {
  const { token } = await signRealtimeToken(process.env.AUTH_SECRET!, { sub: 'user-1', org });
  return token;
}

type TestSocket = Awaited<ReturnType<FastifyInstance['injectWS']>>;

function nextMessage(ws: TestSocket): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    ws.once('message', (raw: unknown) => resolve(JSON.parse(String(raw))));
  });
}

function closeCode(ws: TestSocket): Promise<number> {
  return new Promise((resolve) => ws.once('close', (code: number) => resolve(code)));
}

describe('/ws/client', () => {
  it('fecha com 4401 sem token', async () => {
    const ws = await app.injectWS('/ws/client');
    expect(await closeCode(ws)).toBe(4401);
  });

  it('fecha com 4401 com token inválido', async () => {
    const ws = await app.injectWS('/ws/client?token=forjado.abc');
    expect(await closeCode(ws)).toBe(4401);
  });

  it('subscribe só registra impressoras da org do token', async () => {
    const spy = vi.spyOn(hub, 'subscribe');
    const ws = await app.injectWS(`/ws/client?token=${await tokenFor('org-a')}`);
    ws.send(JSON.stringify({ type: 'subscribe', payload: { printerIds: [OWN, FOREIGN] } }));
    ws.send(JSON.stringify({ type: 'ping', payload: { ts: 1 } }));
    await nextMessage(ws); // pong: fila processou o subscribe antes
    expect(spy).toHaveBeenCalledWith(expect.anything(), [OWN]);
    ws.terminate();
  });

  it('command pra impressora de outra org é recusado e não chega no bridge', async () => {
    const bridge = vi.spyOn(hub, 'sendToBridge').mockReturnValue(true);
    const ws = await app.injectWS(`/ws/client?token=${await tokenFor('org-a')}`);
    ws.send(JSON.stringify({ type: 'command', payload: { printerId: FOREIGN, action: 'stop' } }));
    const msg = await nextMessage(ws);
    expect(msg).toMatchObject({ type: 'error', payload: { code: 'FORBIDDEN' } });
    expect(bridge).not.toHaveBeenCalled();
    ws.terminate();
  });

  it('command pra impressora da própria org chega no bridge', async () => {
    const bridge = vi.spyOn(hub, 'sendToBridge').mockReturnValue(true);
    const ws = await app.injectWS(`/ws/client?token=${await tokenFor('org-a')}`);
    ws.send(JSON.stringify({ type: 'command', payload: { printerId: OWN, action: 'pause' } }));
    ws.send(JSON.stringify({ type: 'ping', payload: { ts: 1 } }));
    await nextMessage(ws);
    expect(bridge).toHaveBeenCalledWith({
      type: 'command',
      payload: expect.objectContaining({ printerId: OWN, action: 'pause' }),
    });
    ws.terminate();
  });
});
