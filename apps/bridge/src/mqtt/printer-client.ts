import { EventEmitter } from 'node:events';
import mqtt, { type MqttClient } from 'mqtt';
import type { PrinterConfig, PrinterState, PrinterEvent, CommandAction } from '@printstudio/shared';
import {
  reportTopic,
  requestTopic,
  applyReport,
  emptyState,
  parseReportJson,
  buildCommandForAction,
  buildPushAllCommand,
} from '@printstudio/bambu-protocol';
import type { Logger } from '../logger.js';

export interface PrinterClientEvents {
  state: (state: PrinterState) => void;
  event: (event: PrinterEvent) => void;
}

// Throttle state emits so we don't flood downstream consumers — mas
// ainda dá sensação de real-time. 500ms = 2 updates/s, o suficiente
// pra temperatura/progresso parecerem contínuos sem saturar a WS.
const STATE_EMIT_THROTTLE_MS = 500;

export class PrinterClient extends EventEmitter {
  private client: MqttClient | null = null;
  private state: PrinterState;
  private lastEmittedAt = 0;
  private online = false;
  private pendingEmit: NodeJS.Timeout | null = null;

  constructor(
    private readonly config: PrinterConfig,
    private readonly logger: Logger,
  ) {
    super();
    this.state = emptyState(config.id);
  }

  get printerId(): string {
    return this.config.id;
  }

  getState(): PrinterState {
    return this.state;
  }

  connect(): void {
    if (!this.config.ipAddress) {
      this.logger.warn({ printerId: this.config.id }, 'printer has no IP; skipping MQTT connect');
      return;
    }
    const url = `mqtts://${this.config.ipAddress}:8883`;
    this.logger.info({ printerId: this.config.id, url }, 'connecting to printer MQTT');

    // Bambu printers use TLS with a self-signed certificate, so we must
    // disable cert validation. Username is always 'bblp'; password is the
    // 8-digit access code shown on the printer LCD.
    this.client = mqtt.connect(url, {
      username: 'bblp',
      password: this.config.accessCode,
      rejectUnauthorized: false,
      reconnectPeriod: 5000,
      connectTimeout: 10_000,
      clean: true,
      clientId: `printstudio-bridge-${this.config.id.slice(0, 8)}`,
    });

    this.client.on('connect', () => this.onConnect());
    this.client.on('reconnect', () => {
      this.logger.debug({ printerId: this.config.id }, 'MQTT reconnecting');
    });
    this.client.on('close', () => this.onClose());
    this.client.on('error', (err) => {
      this.logger.error({ printerId: this.config.id, err: err.message }, 'MQTT error');
    });
    this.client.on('message', (topic, payload) => this.onMessage(topic, payload));
  }

  async disconnect(): Promise<void> {
    if (this.pendingEmit) {
      clearTimeout(this.pendingEmit);
      this.pendingEmit = null;
    }
    if (this.client) {
      await new Promise<void>((resolve) => this.client!.end(false, {}, () => resolve()));
      this.client = null;
    }
  }

  sendCommand(action: CommandAction): { commandId: string; ok: boolean; error?: string } {
    if (!this.client || !this.client.connected) {
      return { commandId: '', ok: false, error: 'MQTT not connected' };
    }
    const cmd = buildCommandForAction(action);
    const topic = requestTopic(this.config.serial);
    const commandId = typeof cmd.print === 'object' && cmd.print !== null && 'sequence_id' in cmd.print
      ? String((cmd.print as { sequence_id: unknown }).sequence_id)
      : '';
    try {
      this.client.publish(topic, JSON.stringify(cmd), { qos: 0 });
      this.logger.info({ printerId: this.config.id, action, commandId }, 'command sent');
      return { commandId, ok: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown publish error';
      return { commandId, ok: false, error: msg };
    }
  }

  private onConnect(): void {
    const wasOffline = !this.online;
    this.online = true;
    this.logger.info({ printerId: this.config.id }, 'MQTT connected');

    const topic = reportTopic(this.config.serial);
    this.client!.subscribe(topic, { qos: 0 }, (err) => {
      if (err) {
        this.logger.error({ printerId: this.config.id, err: err.message }, 'subscribe failed');
        return;
      }
      this.logger.debug({ printerId: this.config.id, topic }, 'subscribed');
      // Request full state snapshot — otherwise we only get deltas.
      this.client!.publish(requestTopic(this.config.serial), JSON.stringify(buildPushAllCommand()), { qos: 0 });
    });

    if (wasOffline) {
      this.emitEvent({
        printerId: this.config.id,
        type: 'PRINTER_ONLINE',
        severity: 'INFO',
        message: `${this.config.name} is online`,
        createdAt: new Date().toISOString(),
      });
    }
  }

  private onClose(): void {
    if (!this.online) return;
    this.online = false;
    this.logger.warn({ printerId: this.config.id }, 'MQTT disconnected');
    this.state = { ...this.state, status: 'OFFLINE', updatedAt: new Date().toISOString() };
    this.emitState();
    this.emitEvent({
      printerId: this.config.id,
      type: 'PRINTER_OFFLINE',
      severity: 'WARN',
      message: `${this.config.name} went offline`,
      createdAt: new Date().toISOString(),
    });
  }

  private onMessage(topic: string, payload: Buffer): void {
    if (topic !== reportTopic(this.config.serial)) return;
    const raw = parseReportJson(payload);
    if (!raw) {
      this.logger.debug({ printerId: this.config.id, topic }, 'unparseable payload');
      return;
    }
    this.state = applyReport(this.state, raw);
    this.scheduleStateEmit();
  }

  private scheduleStateEmit(): void {
    const now = Date.now();
    const elapsed = now - this.lastEmittedAt;
    if (elapsed >= STATE_EMIT_THROTTLE_MS) {
      this.emitState();
      return;
    }
    if (this.pendingEmit) return;
    this.pendingEmit = setTimeout(() => {
      this.pendingEmit = null;
      this.emitState();
    }, STATE_EMIT_THROTTLE_MS - elapsed);
  }

  private emitState(): void {
    this.lastEmittedAt = Date.now();
    this.emit('state', this.state);
  }

  private emitEvent(event: PrinterEvent): void {
    this.emit('event', event);
  }
}
