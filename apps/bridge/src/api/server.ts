import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import fastifyWebsocket from '@fastify/websocket';
import { randomUUID } from 'node:crypto';
import {
  BridgeMessageSchema,
  CommandActionSchema,
  type BridgeMessage,
  type PrinterEvent,
  type PrinterState,
} from '@printstudio/shared';
import type { MqttManager } from '../mqtt/manager.js';
import type { CameraManager } from '../camera/manager.js';
import type { ThumbnailManager } from '../ftp/thumbnail-manager.js';
import type { LayersManager } from '../gcode/layers-manager.js';
import type { Logger } from '../logger.js';

interface ServerOpts {
  manager: MqttManager;
  cameras: CameraManager;
  thumbnails: ThumbnailManager;
  layers: LayersManager;
  logger: Logger;
  port: number;
  bridgeId: string;
}

export async function createServer(opts: ServerOpts): Promise<FastifyInstance> {
  const { manager, cameras, thumbnails, layers, logger, port, bridgeId } = opts;

  const app = Fastify({ logger: false });
  await app.register(cors, { origin: true });
  await app.register(fastifyWebsocket);

  app.get('/api/health', async () => ({
    status: 'ok',
    mode: 'bridge',
    bridgeId,
    printers: manager.getPrinterConfigs().map((p) => ({ id: p.id, name: p.name })),
  }));

  app.get('/api/printers', async () => ({ printers: manager.getAllStates() }));

  app.get<{ Params: { id: string } }>('/api/printers/:id', async (req, reply) => {
    const state = manager.getState(req.params.id);
    if (!state) return reply.code(404).send({ error: 'printer not found' });
    return state;
  });

  app.post<{ Params: { id: string }; Body: { action?: unknown } }>(
    '/api/printers/:id/command',
    async (req, reply) => {
      const actionParse = CommandActionSchema.safeParse(req.body?.action);
      if (!actionParse.success) {
        return reply.code(400).send({ error: 'invalid action', details: actionParse.error.flatten() });
      }
      const result = manager.sendCommand(req.params.id, actionParse.data);
      if (!result.ok) return reply.code(502).send({ error: result.error ?? 'command failed' });
      return { commandId: result.commandId, ok: true };
    },
  );

  // Parsed gcode layers (compact JSON). Frontend renders as SVG animation.
  app.get<{ Params: { id: string } }>('/api/printers/:id/layers.json', async (req, reply) => {
    const cached = layers.get(req.params.id);
    if (!cached) {
      return reply.code(404).send({ error: 'no gcode parsed yet' });
    }
    reply
      .type('application/json')
      .header('Cache-Control', 'no-store')
      .header('Access-Control-Allow-Origin', '*')
      .header('X-Layers-File', encodeURIComponent(cached.fileName))
      .send({
        fileName: cached.fileName,
        fetchedAt: cached.fetchedAt,
        ...cached.data,
      });
    return reply;
  });

  // Current print-job thumbnail extracted from the printer's `.3mf` via FTPS.
  // Served as PNG with aggressive cache-busting since the underlying job changes.
  app.get<{ Params: { id: string } }>('/api/printers/:id/thumbnail.png', async (req, reply) => {
    const thumb = thumbnails.get(req.params.id);
    if (!thumb) {
      return reply.code(404).send({ error: 'no thumbnail yet' });
    }
    reply
      .type('image/png')
      .header('Cache-Control', 'no-store')
      .header('Access-Control-Allow-Origin', '*')
      .header('X-Thumbnail-File', encodeURIComponent(thumb.fileName))
      .send(thumb.image);
    return reply;
  });

  // MJPEG stream: multipart/x-mixed-replace so a plain <img> tag plays it.
  // Low-tech but works in every browser, zero JS required.
  app.get<{ Params: { id: string } }>('/api/printers/:id/camera.mjpeg', async (req, reply) => {
    const release = cameras.acquire(req.params.id);
    reply.raw.writeHead(200, {
      'Content-Type': 'multipart/x-mixed-replace; boundary=frame',
      'Cache-Control': 'no-cache, no-store, must-revalidate, private',
      'Pragma': 'no-cache',
      'Connection': 'close',
      'Access-Control-Allow-Origin': '*',
    });
    // Push the latest cached frame immediately so the viewer doesn't stare at
    // a blank <img> until the next frame arrives from the printer.
    const initial = cameras.getLatestFrame(req.params.id);
    if (initial) writeFrame(reply.raw, initial);

    const off = cameras.onFrame(req.params.id, (jpeg) => {
      writeFrame(reply.raw, jpeg);
    });

    const cleanup = (): void => {
      off();
      release();
      try {
        reply.raw.end();
      } catch {
        /* ignore */
      }
    };
    req.raw.on('close', cleanup);
    req.raw.on('error', cleanup);
    return reply;
  });

  // LAN WebSocket. Same BridgeMessage protocol used upstream, but here the
  // bridge is the server and the PWA is the client.
  app.register(async (wsApp) => {
    wsApp.get('/ws', { websocket: true }, (socket) => {
      logger.debug('LAN WS client connected');

      const sendBridge = (msg: BridgeMessage): void => {
        const parsed = BridgeMessageSchema.safeParse(msg);
        if (!parsed.success) return;
        try {
          socket.send(JSON.stringify(parsed.data));
        } catch {
          // socket closed mid-send; ignore
        }
      };

      // Send initial snapshot of all printer states.
      for (const state of manager.getAllStates()) {
        sendBridge({ type: 'bridge.state', payload: state });
      }

      const onState = (state: PrinterState): void => sendBridge({ type: 'bridge.state', payload: state });
      const onEvent = (event: PrinterEvent): void => sendBridge({ type: 'bridge.event', payload: event });
      manager.on('state', onState);
      manager.on('event', onEvent);

      socket.on('message', (raw) => {
        let msg: unknown;
        try {
          msg = JSON.parse(raw.toString());
        } catch {
          return;
        }
        if (
          typeof msg === 'object' &&
          msg !== null &&
          'type' in msg &&
          (msg as { type: unknown }).type === 'command' &&
          'payload' in msg
        ) {
          const payload = (msg as { payload: { printerId?: string; action?: unknown; commandId?: string } }).payload;
          if (!payload.printerId) return;
          const actionParse = CommandActionSchema.safeParse(payload.action);
          if (!actionParse.success) return;
          const commandId = payload.commandId ?? randomUUID();
          const result = manager.sendCommand(payload.printerId, actionParse.data);
          sendBridge({
            type: 'bridge.command.ack',
            payload: {
              commandId: result.commandId || commandId,
              success: result.ok,
              error: result.error,
            },
          });
        }
      });

      socket.on('close', () => {
        manager.off('state', onState);
        manager.off('event', onEvent);
        logger.debug('LAN WS client disconnected');
      });
    });
  });

  await app.listen({ port, host: '0.0.0.0' });
  logger.info({ port }, 'bridge HTTP/WS listening');
  return app;
}

function writeFrame(res: import('node:http').ServerResponse, jpeg: Buffer): void {
  try {
    res.write(
      `--frame\r\nContent-Type: image/jpeg\r\nContent-Length: ${jpeg.length}\r\n\r\n`,
    );
    res.write(jpeg);
    res.write('\r\n');
  } catch {
    /* socket likely closed */
  }
}
