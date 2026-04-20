import './env-bootstrap.js';
import { loadConfig } from './config.js';
import { logger } from './logger.js';
import { MqttManager } from './mqtt/manager.js';
import { CloudClient } from './ws/cloud-client.js';
import { createServer } from './api/server.js';
import { JobStore } from './storage/sqlite.js';
import { MdnsPublisher } from './mdns.js';
import { CameraManager } from './camera/manager.js';
import { ThumbnailManager } from './ftp/thumbnail-manager.js';

async function main(): Promise<void> {
  const config = loadConfig();
  logger.info(
    { bridgeId: config.env.BRIDGE_ID, printers: config.printers.length },
    'PrintStudio bridge starting',
  );

  if (config.printers.length === 0) {
    logger.warn('no printers configured — set PRINTER_N_SERIAL / PRINTER_N_ACCESS_CODE in .env');
  }

  const jobStore = new JobStore(config.env.BRIDGE_DB_PATH, logger);

  const manager = new MqttManager(config.printers, logger);
  manager.start();

  const cameras = new CameraManager(config.printers, logger);

  const thumbnails = new ThumbnailManager(config.printers, logger);
  manager.on('state', (state) => thumbnails.onState(state));

  const server = await createServer({
    manager,
    cameras,
    thumbnails,
    logger,
    port: config.env.BRIDGE_PORT,
    bridgeId: config.env.BRIDGE_ID,
  });

  let cloud: CloudClient | null = null;
  if (config.env.CLOUD_WS_URL && config.env.CLOUD_API_TOKEN) {
    cloud = new CloudClient({
      url: config.env.CLOUD_WS_URL,
      token: config.env.CLOUD_API_TOKEN,
      bridgeId: config.env.BRIDGE_ID,
      manager,
      logger,
    });
    cloud.start();
  } else {
    logger.warn('CLOUD_WS_URL or CLOUD_API_TOKEN not set — running LAN-only');
  }

  const mdns = new MdnsPublisher(logger);
  mdns.publish({ name: config.env.BRIDGE_MDNS_NAME, port: config.env.BRIDGE_PORT });

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, 'shutting down');
    try {
      cameras.stopAll();
      cloud?.stop();
      await mdns.unpublish();
      await server.close();
      await manager.stop();
      jobStore.close();
    } catch (err) {
      logger.error({ err: err instanceof Error ? err.message : err }, 'shutdown error');
    } finally {
      process.exit(0);
    }
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((err) => {
  logger.error({ err: err instanceof Error ? err.stack : err }, 'fatal bridge error');
  process.exit(1);
});
