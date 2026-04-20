import type { FastifyInstance } from 'fastify';
import {
  ClientOutboundMessageSchema,
  type PrinterState,
  type HmsError,
  type AmsSlot,
  type SpeedMode,
} from '@printstudio/shared';
import { randomUUID } from 'node:crypto';
import { inArray } from 'drizzle-orm';
import { logger } from '../logger.js';
import { hub } from './hub.js';
import { db } from '../db.js';
import { printerState } from '@printstudio/db';

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
    activeSlotIndex: r.activeSlotIndex,
    speedMode: r.speedMode as SpeedMode | null,
    speedPercent: r.speedPercent === null ? null : Number(r.speedPercent),
    wifiSignalDbm: r.wifiSignalDbm,
    fanPartCoolingPct: r.fanPartCoolingPct,
    fanAuxPct: r.fanAuxPct,
    fanChamberPct: r.fanChamberPct,
    nozzleDiameter: r.nozzleDiameter,
    nozzleType: r.nozzleType,
    stage: r.stage,
    updatedAt: r.updatedAt.toISOString(),
  }));
}

export async function registerClientRelay(app: FastifyInstance): Promise<void> {
  app.get('/ws/client', { websocket: true }, async (socket) => {
    // MVP: no WS auth (internal use, single-origin mismatch between Next :3000 and API :4000).
    // TODO: pass short-lived token via query param when exposing to internet.
    hub.registerClient(socket);
    logger.info('client connected');

    socket.on('message', (raw) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw.toString());
      } catch {
        return;
      }

      const result = ClientOutboundMessageSchema.safeParse(parsed);
      if (!result.success) {
        try {
          socket.send(
            JSON.stringify({
              type: 'error',
              payload: { message: 'invalid message', code: 'BAD_MESSAGE' },
            }),
          );
        } catch {
          /* ignore */
        }
        return;
      }
      const msg = result.data;

      if (msg.type === 'subscribe') {
        hub.subscribe(socket, msg.payload.printerIds);
        // Send current snapshot immediately so the client doesn't wait for the next bridge push.
        void loadSnapshot(msg.payload.printerIds).then((states) => {
          for (const state of states) {
            try {
              socket.send(JSON.stringify({ type: 'printer.state', payload: state }));
            } catch {
              /* ignore */
            }
          }
        });
      } else if (msg.type === 'command') {
        const forwarded = hub.sendToBridge({
          type: 'command',
          payload: {
            printerId: msg.payload.printerId,
            action: msg.payload.action,
            commandId: randomUUID(),
          },
        });
        if (!forwarded) {
          try {
            socket.send(
              JSON.stringify({
                type: 'error',
                payload: { message: 'bridge offline', code: 'BRIDGE_OFFLINE' },
              }),
            );
          } catch {
            /* ignore */
          }
        }
      } else if (msg.type === 'ping') {
        try {
          socket.send(JSON.stringify({ type: 'pong', payload: { ts: msg.payload.ts } }));
        } catch {
          /* ignore */
        }
      }
    });

    socket.on('close', () => {
      hub.unregisterClient(socket);
      logger.info('client disconnected');
    });

    socket.on('error', (err) => {
      logger.error({ err }, 'client socket error');
    });
  });
}
