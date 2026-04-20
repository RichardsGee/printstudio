import { randomUUID } from 'node:crypto';
import WebSocket from 'ws';
import {
  BridgeMessageSchema,
  type BridgeMessage,
  type PrinterEvent,
  type PrinterState,
  type CommandAction,
} from '@printstudio/shared';
import type { MqttManager } from '../mqtt/manager.js';
import type { Logger } from '../logger.js';

interface CloudClientOpts {
  url: string;
  token: string;
  bridgeId: string;
  manager: MqttManager;
  logger: Logger;
}

// Exponential backoff bounded to 30s so we don't hammer the cloud while keeping
// recovery responsive once the outage ends.
const MIN_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 30_000;

export class CloudClient {
  private ws: WebSocket | null = null;
  private backoff = MIN_BACKOFF_MS;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private stopped = false;

  constructor(private readonly opts: CloudClientOpts) {}

  start(): void {
    this.stopped = false;
    this.connect();
    this.opts.manager.on('state', (state: PrinterState) => {
      this.send({ type: 'bridge.state', payload: state });
    });
    this.opts.manager.on('event', (event: PrinterEvent) => {
      this.send({ type: 'bridge.event', payload: event });
    });
  }

  stop(): void {
    this.stopped = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.removeAllListeners();
      this.ws.close();
      this.ws = null;
    }
  }

  private connect(): void {
    const { url, logger } = this.opts;
    logger.info({ url }, 'cloud WS connecting');
    const ws = new WebSocket(url);
    this.ws = ws;

    ws.on('open', () => {
      logger.info({ url }, 'cloud WS connected');
      this.backoff = MIN_BACKOFF_MS;
      this.send({
        type: 'bridge.hello',
        payload: { token: this.opts.token, bridgeId: this.opts.bridgeId },
      });
    });

    ws.on('message', (data) => this.onMessage(data));

    ws.on('close', (code, reason) => {
      logger.warn({ code, reason: reason.toString() }, 'cloud WS closed');
      this.scheduleReconnect();
    });

    ws.on('error', (err) => {
      logger.error({ err: err.message }, 'cloud WS error');
    });
  }

  private scheduleReconnect(): void {
    if (this.stopped) return;
    if (this.reconnectTimer) return;
    const delay = this.backoff;
    this.backoff = Math.min(this.backoff * 2, MAX_BACKOFF_MS);
    this.opts.logger.debug({ delay }, 'cloud WS reconnect scheduled');
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private onMessage(data: WebSocket.RawData): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(data.toString());
    } catch {
      this.opts.logger.debug('cloud WS non-json message');
      return;
    }
    // The cloud side sends ClientOutboundMessage-shaped messages (subscribe,
    // command, ping). We only care about `command` here.
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'type' in parsed &&
      (parsed as { type: unknown }).type === 'command' &&
      'payload' in parsed
    ) {
      const payload = (parsed as { payload: { printerId?: string; action?: CommandAction; commandId?: string } }).payload;
      if (!payload.printerId || !payload.action) return;
      const commandId = payload.commandId ?? randomUUID();
      const result = this.opts.manager.sendCommand(payload.printerId, payload.action);
      this.send({
        type: 'bridge.command.ack',
        payload: {
          commandId: result.commandId || commandId,
          success: result.ok,
          error: result.error,
        },
      });
    }
  }

  private send(message: BridgeMessage): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const parsed = BridgeMessageSchema.safeParse(message);
    if (!parsed.success) {
      this.opts.logger.error({ errors: parsed.error.flatten() }, 'invalid BridgeMessage, dropping');
      return;
    }
    this.ws.send(JSON.stringify(parsed.data));
  }
}
