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
  await app.register(cors, {
    origin: config.API_CORS_ORIGIN,
    credentials: true,
  });
  await app.register(cookie, { secret: config.AUTH_SECRET });
  await app.register(websocket);

  await registerHealthRoutes(app);
  await registerAuthRoutes(app);
  await registerPrinterRoutes(app);
  await registerJobRoutes(app);
  await registerEventRoutes(app);
  await registerBridgeRelay(app);
  await registerClientRelay(app);

  return app;
}
