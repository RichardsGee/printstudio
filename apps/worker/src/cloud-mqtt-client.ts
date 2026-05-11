import { EventEmitter } from 'node:events';
import mqtt, { type MqttClient } from 'mqtt';
import {
  applyReport,
  emptyState,
  parseReportJson,
  buildPushAllCommand,
  reportTopic,
  requestTopic,
} from '@printstudio/bambu-protocol';
import type { PrinterState } from '@printstudio/shared';
import type { Logger } from './logger.js';

const MQTT_HOST = 'us.mqtt.bambulab.com';
const MQTT_PORT = 8883;

export interface CloudMqttDevice {
  printerId: string; // UUID do PrintStudio
  serial: string; // dev_id Bambu — usado no topic
  name: string;
}

export interface CloudMqttOpts {
  bambuUserId: string;
  accessToken: string;
  devices: CloudMqttDevice[];
  logger: Logger;
}

/**
 * Conecta no MQTT cloud da Bambu pra UMA conta (1 JWT), subscreve nos
 * tópicos device/{serial}/report de todas as impressoras dessa conta,
 * e emite o evento 'state' com PrinterState aplicado a cada mensagem.
 *
 * Mantém um cache por printerId pra que `applyReport` possa fazer merge
 * incremental (a Bambu manda deltas, não full state).
 */
export class CloudMqttClient extends EventEmitter {
  private client: MqttClient | null = null;
  private states = new Map<string, PrinterState>();
  private serialToPrinterId = new Map<string, string>();

  constructor(private readonly opts: CloudMqttOpts) {
    super();
    for (const d of opts.devices) {
      this.serialToPrinterId.set(d.serial, d.printerId);
      this.states.set(d.printerId, emptyState(d.printerId));
    }
  }

  start(): void {
    const { bambuUserId, accessToken, logger } = this.opts;
    const url = `mqtts://${MQTT_HOST}:${MQTT_PORT}`;
    logger.info({ url, devices: this.opts.devices.length }, 'cloud MQTT connecting');

    const client = mqtt.connect(url, {
      username: `u_${bambuUserId}`,
      password: accessToken,
      reconnectPeriod: 5_000,
      connectTimeout: 15_000,
      clientId: `printstudio-worker-${bambuUserId}-${Date.now()}`,
      protocolVersion: 4, // MQTT 3.1.1 — Bambu broker
    });
    this.client = client;

    client.on('connect', () => {
      logger.info('cloud MQTT connected');
      for (const d of this.opts.devices) {
        const topic = reportTopic(d.serial);
        client.subscribe(topic, (err) => {
          if (err) {
            logger.error({ err: err.message, topic }, 'subscribe failed');
          } else {
            logger.info({ topic, printerId: d.printerId }, 'subscribed report');
            // pushall pra forçar full state imediatamente
            const pushall = buildPushAllCommand();
            client.publish(requestTopic(d.serial), JSON.stringify(pushall));
          }
        });
      }
    });

    client.on('message', (topic, payload) => {
      const serial = this.extractSerialFromTopic(topic);
      if (!serial) return;
      const printerId = this.serialToPrinterId.get(serial);
      if (!printerId) return;

      const report = parseReportJson(payload);
      if (!report) return;

      const previous = this.states.get(printerId) ?? emptyState(printerId);
      const next = applyReport(previous, report);
      this.states.set(printerId, next);

      this.emit('state', next);
    });

    client.on('reconnect', () => {
      logger.warn('cloud MQTT reconnecting');
    });

    client.on('error', (err) => {
      logger.error({ err: err.message }, 'cloud MQTT error');
    });

    client.on('close', () => {
      logger.warn('cloud MQTT closed');
    });
  }

  stop(): void {
    if (this.client) {
      this.client.end(true);
      this.client = null;
    }
  }

  private extractSerialFromTopic(topic: string): string | null {
    // device/{serial}/report
    const parts = topic.split('/');
    if (parts.length >= 3 && parts[0] === 'device' && parts[2] === 'report') {
      return parts[1] ?? null;
    }
    return null;
  }
}
