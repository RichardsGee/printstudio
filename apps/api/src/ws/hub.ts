import type { WebSocket } from '@fastify/websocket';
import type { PrinterState, PrinterEvent, CommandAction } from '@printstudio/shared';
import { logger } from '../logger.js';

type ClientOutbound =
  | { type: 'printer.state'; payload: PrinterState }
  | { type: 'printer.event'; payload: PrinterEvent }
  | { type: 'error'; payload: { message: string; code?: string } }
  | { type: 'pong'; payload: { ts: number } };

type BridgeOutbound = {
  type: 'command';
  payload: { printerId: string; action: CommandAction; commandId: string };
};

// MVP: single bridge per deployment. Last-writer-wins on reconnect.
class Hub {
  private bridge: WebSocket | null = null;
  private readonly clients = new Map<WebSocket, Set<string>>();

  setBridge(socket: WebSocket): void {
    if (this.bridge && this.bridge !== socket) {
      try {
        this.bridge.close(1012, 'replaced by newer bridge');
      } catch {
        /* swallow — old socket may already be gone */
      }
    }
    this.bridge = socket;
    logger.info('bridge connected to hub');
  }

  clearBridge(socket: WebSocket): void {
    if (this.bridge === socket) {
      this.bridge = null;
      logger.info('bridge disconnected from hub');
    }
  }

  hasBridge(): boolean {
    return this.bridge !== null;
  }

  registerClient(socket: WebSocket): void {
    this.clients.set(socket, new Set());
  }

  unregisterClient(socket: WebSocket): void {
    this.clients.delete(socket);
  }

  subscribe(socket: WebSocket, printerIds: string[]): void {
    const set = this.clients.get(socket);
    if (!set) return;
    for (const id of printerIds) set.add(id);
  }

  sendToBridge(msg: BridgeOutbound): boolean {
    if (!this.bridge) return false;
    try {
      this.bridge.send(JSON.stringify(msg));
      return true;
    } catch (err) {
      logger.error({ err }, 'failed to send to bridge');
      return false;
    }
  }

  // Fan-out to clients subscribed to the specific printerId.
  broadcast(printerId: string, msg: ClientOutbound): void {
    const payload = JSON.stringify(msg);
    for (const [socket, ids] of this.clients) {
      if (!ids.has(printerId)) continue;
      try {
        socket.send(payload);
      } catch (err) {
        logger.warn({ err }, 'failed to send to client');
      }
    }
  }
}

export const hub = new Hub();
