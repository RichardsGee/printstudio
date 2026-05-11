import WebSocket from 'ws';
import {
  BridgeMessageSchema,
  type BridgeMessage,
  type PrinterState,
} from '@printstudio/shared';
import type { Logger } from './logger.js';

interface CloudRelayOpts {
  url: string;
  token: string;
  workerId: string;
  logger: Logger;
}

const MIN_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 30_000;

/**
 * Conecta WebSocket outbound no api do PrintStudio (rota /ws/bridge)
 * e envia bridge.hello + bridge.state. Reusa o mesmo protocolo do
 * bridge LAN — no api, ambos são tratados como "bridges".
 *
 * Reconnect com exponential backoff bounded em 30s.
 */
export class CloudRelay {
  private ws: WebSocket | null = null;
  private backoff = MIN_BACKOFF_MS;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private stopped = false;
  private authed = false;

  constructor(private readonly opts: CloudRelayOpts) {}

  start(): void {
    this.stopped = false;
    this.connect();
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

  sendState(state: PrinterState): void {
    this.send({ type: 'bridge.state', payload: state });
  }

  private connect(): void {
    const { url, logger, workerId, token } = this.opts;
    logger.info({ url, workerId }, 'cloud relay connecting');
    const ws = new WebSocket(url);
    this.ws = ws;
    this.authed = false;

    ws.on('open', () => {
      logger.info('cloud relay connected — sending bridge.hello');
      this.backoff = MIN_BACKOFF_MS;
      this.send({
        type: 'bridge.hello',
        payload: { token, bridgeId: workerId },
      });
      this.authed = true;
    });

    ws.on('close', (code, reason) => {
      logger.warn({ code, reason: reason.toString() }, 'cloud relay closed');
      this.authed = false;
      this.scheduleReconnect();
    });

    ws.on('error', (err) => {
      logger.error({ err: err.message }, 'cloud relay error');
    });

    // Mensagens recebidas do api (commands, etc.) — worker MVP ignora.
    // Pra suportar comandos remotos, parsearia ClientOutboundMessage e
    // mandaria via MQTT publish — fica pra story futura.
    ws.on('message', () => {
      /* ignored in MVP */
    });
  }

  private scheduleReconnect(): void {
    if (this.stopped) return;
    if (this.reconnectTimer) return;
    const delay = this.backoff;
    this.backoff = Math.min(this.backoff * 2, MAX_BACKOFF_MS);
    this.opts.logger.debug({ delay }, 'cloud relay reconnect scheduled');
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private send(message: BridgeMessage): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    if (message.type !== 'bridge.hello' && !this.authed) return;
    const parsed = BridgeMessageSchema.safeParse(message);
    if (!parsed.success) {
      this.opts.logger.error(
        { errors: parsed.error.flatten() },
        'invalid BridgeMessage, dropping',
      );
      return;
    }
    this.ws.send(JSON.stringify(parsed.data));
  }
}
