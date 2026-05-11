/**
 * PrintStudio Cloud Worker — entry point.
 *
 * Bootstrap:
 *   1. Lê bambu_credentials da org configurada (DB)
 *   2. Decripta access_token com BAMBU_CRED_KEY
 *   3. Lista devices via Bambu Cloud user/bind
 *   4. Faz upsert dos devices em `printers` (org-scoped)
 *   5. Conecta MQTT cloud (us.mqtt.bambulab.com)
 *   6. Conecta WS no api PrintStudio (/ws/bridge)
 *   7. Encaminha state events de MQTT → WS api
 *
 * Reage a:
 *   - SIGINT/SIGTERM → shutdown limpo
 *
 * NÃO incluso no MVP (próximas stories):
 *   - Token refresh automático (token Bambu expira em ~90d)
 *   - Multi-org num único worker
 *   - Comandos remotos (pause/resume/stop via MQTT publish)
 *   - Hot-reload de credenciais (atualizar quando user reconecta na UI)
 */

import { config } from './config.js';
import { logger } from './logger.js';
import { loadCredential, closeDb as closeCredentialDb } from './credentials.js';
import { listBoundDevices } from './bambu-cloud-api.js';
import { syncPrintersWithCloud, closeDb as closeRegistryDb } from './printer-registry.js';
import { CloudMqttClient } from './cloud-mqtt-client.js';
import { CloudRelay } from './cloud-relay.js';

async function main(): Promise<void> {
  logger.info(
    {
      workerId: config.WORKER_ID,
      organizationId: config.ORGANIZATION_ID,
      env: config.NODE_ENV,
    },
    'worker starting',
  );

  const cred = await loadCredential();
  if (!cred) {
    logger.warn(
      'Sem credenciais Bambu Cloud — encerrando. Conecte a conta via UI (/settings/bambu-connect) e re-start o worker.',
    );
    process.exit(0);
  }
  logger.info(
    {
      bambuEmail: cred.bambuEmail,
      bambuUserId: cred.bambuUserId,
      expiresAt: cred.accessTokenExpiresAt.toISOString(),
    },
    'credentials loaded',
  );

  const now = Date.now();
  const ttlMs = cred.accessTokenExpiresAt.getTime() - now;
  if (ttlMs <= 0) {
    logger.error(
      { expiresAt: cred.accessTokenExpiresAt.toISOString() },
      'token Bambu expirado — re-conectar via UI',
    );
    process.exit(1);
  }
  if (ttlMs < 7 * 24 * 60 * 60 * 1000) {
    logger.warn(
      { daysRemaining: Math.floor(ttlMs / 86400000) },
      'token Bambu expira em < 7 dias — programar re-login',
    );
  }

  const boundDevices = await listBoundDevices(cred.accessToken);
  if (boundDevices.length === 0) {
    logger.error('Nenhuma impressora vinculada à conta Bambu — encerrando.');
    process.exit(1);
  }
  logger.info(
    {
      count: boundDevices.length,
      devices: boundDevices.map((d) => ({ serial: d.serial, name: d.name, online: d.online })),
    },
    'devices bound to account',
  );

  const registered = await syncPrintersWithCloud(boundDevices);
  logger.info({ count: registered.length }, 'printers sync done');

  const mqttClient = new CloudMqttClient({
    bambuUserId: cred.bambuUserId,
    accessToken: cred.accessToken,
    devices: registered,
    logger,
  });

  const relay = new CloudRelay({
    url: config.CLOUD_WS_URL,
    token: config.CLOUD_API_TOKEN,
    workerId: config.WORKER_ID,
    logger,
  });

  // Conecta o MQTT → relay (todo state vira bridge.state pro api)
  mqttClient.on('state', (state) => {
    relay.sendState(state);
  });

  relay.start();
  mqttClient.start();

  // Shutdown limpo
  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, 'shutdown requested');
    mqttClient.stop();
    relay.stop();
    await Promise.all([closeCredentialDb(), closeRegistryDb()]);
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((err) => {
  logger.error({ err }, 'worker failed to start');
  process.exit(1);
});
