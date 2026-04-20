import type { FastifyInstance } from 'fastify';
import { BridgeMessageSchema, PrinterStateSchema, PrinterEventSchema } from '@printstudio/shared';
import { and, eq, sql, isNull } from 'drizzle-orm';
import { printerState, events, temperatureSamples, printJobs, printers as printersTable } from '@printstudio/db';
import type { PrinterStatus } from '@printstudio/shared';
import { processStateAlerts } from '../notifier/alerts.js';
import { db } from '../db.js';
import { config } from '../config.js';
import { logger } from '../logger.js';
import { hub } from './hub.js';

// Throttle de inserts em temperature_samples — 1 amostra/minuto por
// printer. Em 3 printers isso dá ~4300 linhas/dia, trivial no Postgres.
const lastSampleAt = new Map<string, number>();
const TEMP_SAMPLE_INTERVAL_MS = 60_000;

// Cache de nome humano por printerId pra usar nas notificações.
// Populado on-demand no primeiro state recebido.
const printerNames = new Map<string, string>();

async function ensurePrinterName(printerId: string): Promise<void> {
  if (printerNames.has(printerId)) return;
  const rows = await db
    .select({ name: printersTable.name })
    .from(printersTable)
    .where(eq(printersTable.id, printerId))
    .limit(1);
  if (rows[0]) printerNames.set(printerId, rows[0].name);
}

// Rastreio de status anterior por printer pra detectar transições de
// ciclo de impressão (IDLE → PRINTING → FINISH/FAILED) e registrar em
// `print_jobs`.
const lastStatus = new Map<string, PrinterStatus>();

type LifecycleAction =
  | { type: 'start'; fileName: string | null }
  | { type: 'finish'; success: boolean }
  | null;

function detectLifecycleTransition(
  prev: PrinterStatus | undefined,
  next: PrinterStatus,
  fileName: string | null,
): LifecycleAction {
  const wasPrinting = prev === 'PRINTING' || prev === 'PREPARE' || prev === 'PAUSED';
  const isPrinting = next === 'PRINTING' || next === 'PREPARE' || next === 'PAUSED';
  if (!wasPrinting && isPrinting) {
    return { type: 'start', fileName };
  }
  if (wasPrinting && (next === 'FINISH' || next === 'FAILED' || next === 'IDLE')) {
    return { type: 'finish', success: next === 'FINISH' };
  }
  return null;
}

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
              amsUnits: state.amsUnits,
              activeSlotIndex: state.activeSlotIndex,
              speedMode: state.speedMode,
              speedPercent: state.speedPercent?.toString() ?? null,
              wifiSignalDbm: state.wifiSignalDbm,
              fanPartCoolingPct: state.fanPartCoolingPct,
              fanAuxPct: state.fanAuxPct,
              fanChamberPct: state.fanChamberPct,
              fanHeatbreakPct: state.fanHeatbreakPct,
              nozzleDiameter: state.nozzleDiameter,
              nozzleType: state.nozzleType,
              stage: state.stage,
              doorOpen: state.doorOpen,
              isFromSdCard: state.isFromSdCard,
              lifecycle: state.lifecycle,
              printType: state.printType,
              printErrorCode: state.printErrorCode,
              stateChangeReason: state.stateChangeReason,
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
                amsUnits: sql`excluded.ams_units`,
                activeSlotIndex: sql`excluded.active_slot_index`,
                speedMode: sql`excluded.speed_mode`,
                speedPercent: sql`excluded.speed_percent`,
                wifiSignalDbm: sql`excluded.wifi_signal_dbm`,
                fanPartCoolingPct: sql`excluded.fan_part_cooling_pct`,
                fanAuxPct: sql`excluded.fan_aux_pct`,
                fanChamberPct: sql`excluded.fan_chamber_pct`,
                fanHeatbreakPct: sql`excluded.fan_heatbreak_pct`,
                nozzleDiameter: sql`excluded.nozzle_diameter`,
                nozzleType: sql`excluded.nozzle_type`,
                stage: sql`excluded.stage`,
                doorOpen: sql`excluded.door_open`,
                isFromSdCard: sql`excluded.is_from_sd_card`,
                lifecycle: sql`excluded.lifecycle`,
                printType: sql`excluded.print_type`,
                printErrorCode: sql`excluded.print_error_code`,
                stateChangeReason: sql`excluded.state_change_reason`,
                updatedAt: sql`excluded.updated_at`,
              },
            });

          // Detecta transições de lifecycle e grava em print_jobs.
          const prevStatus = lastStatus.get(state.printerId);
          const lifecycleAction = detectLifecycleTransition(
            prevStatus,
            state.status,
            state.currentFile,
          );
          lastStatus.set(state.printerId, state.status);

          if (lifecycleAction?.type === 'start' && lifecycleAction.fileName) {
            // Cria uma nova linha RUNNING. Se já existir uma RUNNING aberta
            // pra esse printer, fecha como CANCELLED primeiro pra não gerar
            // ghosts (caso tenhamos perdido o evento de fim anterior).
            void db
              .update(printJobs)
              .set({ status: 'CANCELLED', finishedAt: new Date() })
              .where(and(eq(printJobs.printerId, state.printerId), eq(printJobs.status, 'RUNNING')))
              .then(() =>
                db.insert(printJobs).values({
                  printerId: state.printerId,
                  fileName: lifecycleAction.fileName ?? 'sem nome',
                  startedAt: new Date(),
                  status: 'RUNNING',
                  layersTotal: state.totalLayers ?? null,
                }),
              )
              .catch((err) => logger.warn({ err }, 'print_jobs: start insert failed'));
          } else if (lifecycleAction?.type === 'finish') {
            void db
              .update(printJobs)
              .set({
                status: lifecycleAction.success ? 'SUCCESS' : 'FAILED',
                finishedAt: new Date(),
                durationSec: sql`EXTRACT(EPOCH FROM (NOW() - ${printJobs.startedAt}))::int`,
                layersTotal: state.totalLayers ?? null,
              })
              .where(and(eq(printJobs.printerId, state.printerId), eq(printJobs.status, 'RUNNING')))
              .catch((err) => logger.warn({ err }, 'print_jobs: finish update failed'));
          }

          // Arquiva amostra de temperatura throttled a 1/min pra o gráfico de 24h.
          if (state.nozzleTemp !== null || state.bedTemp !== null) {
            const now = Date.now();
            const last = lastSampleAt.get(state.printerId) ?? 0;
            if (now - last >= TEMP_SAMPLE_INTERVAL_MS) {
              lastSampleAt.set(state.printerId, now);
              void db.insert(temperatureSamples).values({
                printerId: state.printerId,
                nozzleTemp: state.nozzleTemp?.toString() ?? null,
                nozzleTargetTemp: state.nozzleTargetTemp?.toString() ?? null,
                bedTemp: state.bedTemp?.toString() ?? null,
                bedTargetTemp: state.bedTargetTemp?.toString() ?? null,
                chamberTemp: state.chamberTemp?.toString() ?? null,
              }).catch((err) => logger.warn({ err }, 'temperature sample insert failed'));
            }
          }

          // Alertas baseados em transições de estado (HMS crítico, falha,
          // porta aberta, conclusão). Disparo assíncrono — não bloqueia
          // o broadcast nem o relay.
          void ensurePrinterName(state.printerId).then(() =>
            processStateAlerts(state, printerNames),
          );

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
