import Fastify, { type FastifyInstance, type FastifyBaseLogger } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import cookie from '@fastify/cookie';
import websocket from '@fastify/websocket';
import { config } from './config.js';
import { logger } from './logger.js';
import { registerHealthRoutes } from './routes/health.js';
import { registerPrinterRoutes } from './routes/printers.js';
import { registerJobRoutes } from './routes/jobs.js';
import { registerEventRoutes } from './routes/events.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerBambuRoutes } from './routes/bambu.js';
import { registerWaitlistRoutes } from './routes/waitlist.js';
import { registerBridgeRelay } from './ws/bridge-relay.js';
import { registerClientRelay } from './ws/client-relay.js';

export async function buildServer(): Promise<FastifyInstance> {
  // Pino's Logger type is a superset of FastifyBaseLogger; Fastify 5's generic
  // inference gets confused when routes are registered with the default FastifyInstance type.
  const app = Fastify({
    loggerInstance: logger as unknown as FastifyBaseLogger,
    trustProxy: true,
  });

  await app.register(helmet, { contentSecurityPolicy: false });

  // CORS aceita múltiplas origins (story 7.3 — waitlist público em
  // guiaprint3d.com precisa coexistir com app autenticado).
  // Format env: comma-separated URLs.
  const allowedOrigins = [
    ...config.API_CORS_ORIGIN.split(',').map((s) => s.trim()).filter(Boolean),
    ...(config.API_PUBLIC_CORS_ORIGINS?.split(',').map((s) => s.trim()).filter(Boolean) ?? []),
  ];
  await app.register(cors, {
    origin: allowedOrigins.length === 1 ? allowedOrigins[0] : allowedOrigins,
    credentials: true,
  });
  await app.register(cookie, { secret: config.AUTH_SECRET });
  await app.register(websocket);

  await registerHealthRoutes(app);
  await registerWaitlistRoutes(app);
  await registerAuthRoutes(app);
  await registerBambuRoutes(app);
  await registerPrinterRoutes(app);
  await registerJobRoutes(app);
  await registerEventRoutes(app);
  await registerBridgeRelay(app);
  await registerClientRelay(app);

  return app;
}
