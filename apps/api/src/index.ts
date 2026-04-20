import './env-bootstrap.js';
import { config } from './config.js';
import { logger } from './logger.js';
import { buildServer } from './server.js';

async function main() {
  const server = await buildServer();

  try {
    await server.listen({ port: config.API_PORT, host: '0.0.0.0' });
    logger.info({ port: config.API_PORT, env: config.NODE_ENV }, 'api listening');
  } catch (err) {
    logger.error({ err }, 'failed to start api');
    process.exit(1);
  }

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'shutdown requested');
    try {
      await server.close();
      process.exit(0);
    } catch (err) {
      logger.error({ err }, 'shutdown failed');
      process.exit(1);
    }
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

void main();
