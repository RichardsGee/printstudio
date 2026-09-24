import type { FastifyInstance } from 'fastify';
import {
  ClientOutboundMessageSchema,
  verifyRealtimeToken,
  type PrinterState,
  type HmsError,
  type AmsSlot,
  type AmsUnit,
  type SpeedMode,
} from '@printstudio/shared';
import { randomUUID } from 'node:crypto';
import { inArray } from 'drizzle-orm';
import { logger } from '../logger.js';
import { hub } from './hub.js';
import { db } from '../db.js';
import { printerState } from '@printstudio/db';
import { config } from '../config.js';
import { filterOrgPrinterIds } from '../middleware/realtime-auth.js';

async function loadSnapshot(printerIds: string[]): Promise<PrinterState[]> {
  if (printerIds.length === 0) return [];
  const rows = await db.select().from(printerState).where(inArray(printerState.printerId, printerIds));
  return rows.map((r) => ({
    printerId: r.printerId,
    status: r.status,
    progressPct: r.progressPct === null ? null : Number(r.progressPct),
    currentLayer: r.currentLayer,
    totalLayers: r.totalLayers,
    nozzleTemp: r.nozzleTemp === null ? null : Number(r.nozzleTemp),
    nozzleTargetTemp: r.nozzleTargetTemp === null ? null : Number(r.nozzleTargetTemp),
    bedTemp: r.bedTemp === null ? null : Number(r.bedTemp),
    bedTargetTemp: r.bedTargetTemp === null ? null : Number(r.bedTargetTemp),
    chamberTemp: r.chamberTemp === null ? null : Number(r.chamberTemp),
    remainingSec: r.remainingSec,
    currentFile: r.currentFile,
    hmsErrors: (r.hmsErrors ?? []) as HmsError[],
    amsSlots: (r.amsState ?? []) as AmsSlot[],
    amsUnits: (r.amsUnits ?? []) as AmsUnit[],
    activeSlotIndex: r.activeSlotIndex,
    speedMode: r.speedMode as SpeedMode | null,
    speedPercent: r.speedPercent === null ? null : Number(r.speedPercent),
    wifiSignalDbm: r.wifiSignalDbm,
    fanPartCoolingPct: r.fanPartCoolingPct,
    fanAuxPct: r.fanAuxPct,
    fanChamberPct: r.fanChamberPct,
    fanHeatbreakPct: r.fanHeatbreakPct,
    nozzleDiameter: r.nozzleDiameter,
    nozzleType: r.nozzleType,
    stage: r.stage,
    doorOpen: r.doorOpen,
    isFromSdCard: r.isFromSdCard,
    lifecycle: r.lifecycle,
    printType: r.printType,
    printErrorCode: r.printErrorCode,
    stateChangeReason: r.stateChangeReason,
    currentBambuModelId: r.currentBambuModelId,
    currentPlateIndex: r.currentPlateIndex,
    currentTaskCoverUrl: r.currentTaskCoverUrl,
    currentTaskTopUrl: r.currentTaskTopUrl,
    currentTaskPickUrl: r.currentTaskPickUrl,
    updatedAt: r.updatedAt.toISOString(),
  }));
}

export async function registerClientRelay(app: FastifyInstance): Promise<void> {
  app.get('/ws/client', { websocket: true }, (socket, req) => {
    // O token vem na query porque o browser não manda header no upgrade
    // de WebSocket. Assinado pelo web (`/api/realtime-token`), escopa o
    // socket a UMA organização: subscribe e command só valem pra
    // impressoras dela.
    const token = (req.query as { token?: unknown } | undefined)?.token;
    const auth = verifyRealtimeToken(config.AUTH_SECRET, typeof token === 'string' ? token : null);

    hub.registerClient(socket);

    function reply(msg: unknown) {
      try {
        socket.send(JSON.stringify(msg));
      } catch {
        /* ignore */
      }
    }

    // Listeners anexados de forma síncrona (senão o subscribe mandado no
    // `open` do browser se perde) e processados em fila, pra um command
    // logo depois do subscribe não ser avaliado antes dele.
    let queue: Promise<void> = auth.then((payload) => {
      if (!payload) {
        logger.warn({ ip: req.ip }, 'client rejected: invalid realtime token');
        socket.close(4401, 'unauthorized');
        return;
      }
      logger.info({ org: payload.org }, 'client connected');
    });

    socket.on('message', (raw: Buffer) => {
      queue = queue
        .then(async () => {
          const payload = await auth;
          if (!payload) return;
          await handleMessage(raw, payload.org);
        })
        .catch((err: unknown) => {
          logger.error({ err }, 'client message failed');
        });
    });

    async function handleMessage(raw: Buffer, organizationId: string) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw.toString());
      } catch {
        return;
      }

      const result = ClientOutboundMessageSchema.safeParse(parsed);
      if (!result.success) {
        reply({ type: 'error', payload: { message: 'invalid message', code: 'BAD_MESSAGE' } });
        return;
      }
      const msg = result.data;

      if (msg.type === 'subscribe') {
        const allowed = await filterOrgPrinterIds(organizationId, msg.payload.printerIds);
        hub.subscribe(socket, allowed);
        // Send current snapshot immediately so the client doesn't wait for the next bridge push.
        const states = await loadSnapshot(allowed);
        for (const state of states) reply({ type: 'printer.state', payload: state });
      } else if (msg.type === 'command') {
        const [allowed] = await filterOrgPrinterIds(organizationId, [msg.payload.printerId]);
        if (!allowed) {
          logger.warn(
            { org: organizationId, printerId: msg.payload.printerId },
            'command rejected: printer outside org',
          );
          reply({ type: 'error', payload: { message: 'forbidden', code: 'FORBIDDEN' } });
          return;
        }
        const forwarded = hub.sendToBridge({
          type: 'command',
          payload: {
            printerId: allowed,
            action: msg.payload.action,
            commandId: randomUUID(),
          },
        });
        if (!forwarded) {
          reply({ type: 'error', payload: { message: 'bridge offline', code: 'BRIDGE_OFFLINE' } });
        }
      } else if (msg.type === 'ping') {
        reply({ type: 'pong', payload: { ts: msg.payload.ts } });
      }
    }

    socket.on('close', () => {
      hub.unregisterClient(socket);
      logger.info('client disconnected');
    });

    socket.on('error', (err: Error) => {
      logger.error({ err }, 'client socket error');
    });
  });
}
