import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import fastifyWebsocket from '@fastify/websocket';
import multipart from '@fastify/multipart';
import { randomUUID } from 'node:crypto';
import { gzipSync } from 'node:zlib';
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
import type { ModelStore } from '../storage/model-store.js';
import { extractPrimaryMesh } from '../storage/mesh-extractor.js';
import type { Logger } from '../logger.js';

interface ServerOpts {
  manager: MqttManager;
  cameras: CameraManager;
  thumbnails: ThumbnailManager;
  layers: LayersManager;
  models: ModelStore;
  logger: Logger;
  port: number;
  bridgeId: string;
}

export async function createServer(opts: ServerOpts): Promise<FastifyInstance> {
  const { manager, cameras, thumbnails, layers, models, logger, port, bridgeId } = opts;

  const app = Fastify({ logger: false });
  await app.register(cors, { origin: true });
  await app.register(fastifyWebsocket);
  // Limit 200MB — .3mf grandes (modelos detalhados) podem ter 100MB+.
  await app.register(multipart, { limits: { fileSize: 200 * 1024 * 1024 } });

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
  // Gzipa manualmente quando o cliente aceita — o payload de ~2MB vira
  // ~150KB, cortando o "pesado" do preview quase todo.
  app.get<{ Params: { id: string } }>('/api/printers/:id/layers.json', async (req, reply) => {
    const cached = layers.get(req.params.id);
    if (!cached) {
      return reply.code(404).send({ error: 'no gcode parsed yet' });
    }
    const body = JSON.stringify({
      fileName: cached.fileName,
      fetchedAt: cached.fetchedAt,
      ...cached.data,
    });
    const acceptsGzip = /gzip/i.test(String(req.headers['accept-encoding'] ?? ''));
    reply
      .type('application/json')
      .header('Cache-Control', 'no-store')
      .header('Access-Control-Allow-Origin', '*')
      .header('X-Layers-File', encodeURIComponent(cached.fileName));
    if (acceptsGzip) {
      reply.header('Content-Encoding', 'gzip').send(gzipSync(body));
    } else {
      reply.send(body);
    }
    return reply;
  });

  // Upload de .3mf original (com mesh) pro render realista. Substitui
  // qualquer arquivo previamente associado a essa impressora.
  app.post<{ Params: { id: string } }>(
    '/api/printers/:id/upload-model',
    async (req, reply) => {
      const file = await req.file();
      if (!file) return reply.code(400).send({ error: 'no file in request' });
      if (!/\.3mf$/i.test(file.filename ?? '')) {
        return reply.code(400).send({ error: 'file must be .3mf' });
      }
      const buf = await file.toBuffer();
      if (buf.length === 0) return reply.code(400).send({ error: 'empty file' });

      const meta = await models.save(req.params.id, buf, file.filename);
      logger.info(
        { printerId: req.params.id, originalName: meta.originalName, sizeMB: (meta.size / 1024 / 1024).toFixed(1) },
        'model uploaded',
      );
      return { ok: true, ...meta };
    },
  );

  // Info do modelo associado (pra UI mostrar "vinculado" / "não vinculado").
  app.get<{ Params: { id: string } }>(
    '/api/printers/:id/uploaded-model.info',
    async (req, reply) => {
      const info = await models.info(req.params.id);
      if (!info) return reply.code(404).send({ error: 'no model uploaded' });
      return info;
    },
  );

  // Mesh parseado do .3mf uploaded — pra render 3D realista no client.
  // Cache simples em memória pra evitar re-parsear .3mf de 100MB+ a cada
  // request: chave = printerId + uploadedAt.
  const meshCache = new Map<string, { uploadedAt: number; payload: string }>();
  app.get<{ Params: { id: string } }>(
    '/api/printers/:id/uploaded-model.json',
    async (req, reply) => {
      const printerId = req.params.id;
      const info = await models.info(printerId);
      if (!info) return reply.code(404).send({ error: 'no model uploaded' });

      const cached = meshCache.get(printerId);
      let payload: string;
      if (cached && cached.uploadedAt === info.uploadedAt) {
        payload = cached.payload;
      } else {
        const buf = await models.load(printerId);
        if (!buf) return reply.code(404).send({ error: 'model file missing' });
        const t0 = Date.now();
        const mesh = extractPrimaryMesh(buf);
        if (!mesh) {
          return reply.code(422).send({
            error: 'mesh not found in .3mf — file may be invalid or sliced-only',
          });
        }
        logger.info(
          {
            printerId,
            triangles: mesh.triangleCount,
            vertices: mesh.vertexCount,
            parseMs: Date.now() - t0,
          },
          'mesh: extracted from uploaded .3mf',
        );
        payload = JSON.stringify({ ...mesh, fileName: info.originalName });
        meshCache.set(printerId, { uploadedAt: info.uploadedAt, payload });
      }

      const acceptsGzip = /gzip/i.test(String(req.headers['accept-encoding'] ?? ''));
      reply
        .type('application/json')
        .header('Cache-Control', 'no-store')
        .header('Access-Control-Allow-Origin', '*');
      if (acceptsGzip) {
        reply.header('Content-Encoding', 'gzip').send(gzipSync(payload));
      } else {
        reply.send(payload);
      }
      return reply;
    },
  );

  // Remove o modelo associado.
  app.delete<{ Params: { id: string } }>(
    '/api/printers/:id/uploaded-model',
    async (req) => {
      await models.remove(req.params.id);
      logger.info({ printerId: req.params.id }, 'model unbound');
      return { ok: true };
    },
  );

  // Current print-job thumbnail extracted from the printer's `.3mf` via FTPS.
  // Quando o cliente passa `?file=`, só devolve se o cache bater com o
  // arquivo solicitado — evita mostrar thumbnail antigo entre a mudança
  // do currentFile e o fetch do novo .3mf (que leva alguns segundos).
  app.get<{ Params: { id: string }; Querystring: { file?: string } }>(
    '/api/printers/:id/thumbnail.png',
    async (req, reply) => {
      const thumb = thumbnails.get(req.params.id);
      if (!thumb) {
        return reply.code(404).send({ error: 'no thumbnail yet' });
      }
      const requested = req.query.file;
      if (requested && requested !== thumb.fileName) {
        // Cliente pediu o thumbnail do arquivo X mas só temos do Y —
        // provavelmente o bridge ainda não baixou o novo .3mf.
        return reply.code(404).send({ error: 'thumbnail for different file' });
      }
      reply
        .type('image/png')
        .header('Cache-Control', 'no-store')
        .header('Access-Control-Allow-Origin', '*')
        .header('X-Thumbnail-File', encodeURIComponent(thumb.fileName))
        .send(thumb.image);
      return reply;
    },
  );

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
