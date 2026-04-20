import type { FastifyInstance } from 'fastify';
import { BridgeMessageSchema, PrinterStateSchema, PrinterEventSchema } from '@printstudio/shared';
import { sql } from 'drizzle-orm';
import { printerState, events } from '@printstudio/db';
import { db } from '../db.js';
import { config } from '../config.js';
import { logger } from '../logger.js';
import { hub } from './hub.js';

export async function registerBridgeRelay(app: FastifyInstance): Promise<void> {
  app.get('/ws/bridge', { websocket: true }, (socket, req) => {
    let authenticated = false;
    let bridgeId: string | null = null;

    const helloTimeout = setTimeout(() => {
      if (!authenticated) {
        logger.warn({ ip: req.ip }, 'bridge hello timeout');
        try {
          socket.close(4001, 'hello timeout');
        } catch {
          /* ignore */
        }
      }
    }, 5000);

    socket.on('message', async (raw) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw.toString());
      } catch {
        socket.close(4002, 'invalid json');
        return;
      }

      const result = BridgeMessageSchema.safeParse(parsed);
      if (!result.success) {
        logger.warn({ issues: result.error.issues }, 'invalid bridge message');
        socket.close(4003, 'invalid message');
        return;
      }
      const msg = result.data;

      // First message MUST be bridge.hello with valid token.
      if (!authenticated) {
        if (msg.type !== 'bridge.hello') {
          socket.close(4004, 'hello required');
          return;
        }
        if (msg.payload.token !== config.CLOUD_API_TOKEN) {
          logger.warn({ ip: req.ip }, 'bridge hello rejected: bad token');
          socket.close(4401, 'unauthorized');
          return;
        }
        authenticated = true;
        bridgeId = msg.payload.bridgeId;
        clearTimeout(helloTimeout);
        hub.setBridge(socket);
        logger.info({ bridgeId, ip: req.ip }, 'bridge authenticated');
        return;
      }

      try {
        if (msg.type === 'bridge.state') {
          const state = PrinterStateSchema.parse(msg.payload);
          await db
            .insert(printerState)
            .values({
              printerId: state.printerId,
              status: state.status,
              progressPct: state.progressPct?.toString() ?? null,
              currentLayer: state.currentLayer,
              totalLayers: state.totalLayers,
              nozzleTemp: state.nozzleTemp?.toString() ?? null,
              nozzleTargetTemp: state.nozzleTargetTemp?.toString() ?? null,
              bedTemp: state.bedTemp?.toString() ?? null,
              bedTargetTemp: state.bedTargetTemp?.toString() ?? null,
              chamberTemp: state.chamberTemp?.toString() ?? null,
              remainingSec: state.remainingSec,
              currentFile: state.currentFile,
              hmsErrors: state.hmsErrors,
              amsState: state.amsSlots,
              activeSlotIndex: state.activeSlotIndex,
              speedMode: state.speedMode,
              speedPercent: state.speedPercent?.toString() ?? null,
              wifiSignalDbm: state.wifiSignalDbm,
              fanPartCoolingPct: state.fanPartCoolingPct,
              fanAuxPct: state.fanAuxPct,
              fanChamberPct: state.fanChamberPct,
              nozzleDiameter: state.nozzleDiameter,
              nozzleType: state.nozzleType,
              stage: state.stage,
              updatedAt: new Date(state.updatedAt),
            })
            .onConflictDoUpdate({
              target: printerState.printerId,
              set: {
                status: sql`excluded.status`,
                progressPct: sql`excluded.progress_pct`,
                currentLayer: sql`excluded.current_layer`,
                totalLayers: sql`excluded.total_layers`,
                nozzleTemp: sql`excluded.nozzle_temp`,
                nozzleTargetTemp: sql`excluded.nozzle_target_temp`,
                bedTemp: sql`excluded.bed_temp`,
                bedTargetTemp: sql`excluded.bed_target_temp`,
                chamberTemp: sql`excluded.chamber_temp`,
                remainingSec: sql`excluded.remaining_sec`,
                currentFile: sql`excluded.current_file`,
                hmsErrors: sql`excluded.hms_errors`,
                amsState: sql`excluded.ams_state`,
                activeSlotIndex: sql`excluded.active_slot_index`,
                speedMode: sql`excluded.speed_mode`,
                speedPercent: sql`excluded.speed_percent`,
                wifiSignalDbm: sql`excluded.wifi_signal_dbm`,
                fanPartCoolingPct: sql`excluded.fan_part_cooling_pct`,
                fanAuxPct: sql`excluded.fan_aux_pct`,
                fanChamberPct: sql`excluded.fan_chamber_pct`,
                nozzleDiameter: sql`excluded.nozzle_diameter`,
                nozzleType: sql`excluded.nozzle_type`,
                stage: sql`excluded.stage`,
                updatedAt: sql`excluded.updated_at`,
              },
            });

          hub.broadcast(state.printerId, { type: 'printer.state', payload: state });
        } else if (msg.type === 'bridge.event') {
          const event = PrinterEventSchema.parse(msg.payload);
          await db.insert(events).values({
            printerId: event.printerId,
            type: event.type,
            severity: event.severity,
            message: event.message,
            payload: event.payload ?? null,
            createdAt: new Date(event.createdAt),
          });
          hub.broadcast(event.printerId, { type: 'printer.event', payload: event });
        } else if (msg.type === 'bridge.command.ack') {
          logger.debug({ ack: msg.payload }, 'bridge command ack');
        }
      } catch (err) {
        logger.error({ err, msgType: msg.type }, 'failed to process bridge message');
      }
    });

    socket.on('close', () => {
      clearTimeout(helloTimeout);
      hub.clearBridge(socket);
      if (bridgeId) logger.info({ bridgeId }, 'bridge socket closed');
    });

    socket.on('error', (err) => {
      logger.error({ err, bridgeId }, 'bridge socket error');
    });
  });

}
