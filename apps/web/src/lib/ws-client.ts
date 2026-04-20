'use client';

import {
  ClientInboundMessageSchema,
  type ClientInboundMessage,
  type ClientOutboundMessage,
  type CommandAction,
} from '@printstudio/shared';

type Listener = (msg: ClientInboundMessage) => void;

export class WsClient {
  private socket: WebSocket | null = null;
  private listeners = new Set<Listener>();
  private url: string;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private closedByUser = false;
  private subscribedIds: string[] = [];

  constructor(url: string) {
    this.url = url;
  }

  connect() {
    this.closedByUser = false;
    this.open();
  }

  private open() {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) return;

    const socket = new WebSocket(this.url);
    this.socket = socket;

    socket.addEventListener('open', () => {
      this.reconnectAttempts = 0;
      if (this.subscribedIds.length > 0) this.subscribe(this.subscribedIds);
      this.pingTimer = setInterval(() => this.ping(), 25_000);
    });

    socket.addEventListener('message', (event) => {
      try {
        const raw = JSON.parse(String(event.data));
        const parsed = ClientInboundMessageSchema.safeParse(raw);
        if (!parsed.success) return;
        for (const l of this.listeners) l(parsed.data);
      } catch {
        // ignore malformed frame
      }
    });

    socket.addEventListener('close', () => {
      this.teardown();
      if (!this.closedByUser) this.scheduleReconnect();
    });

    socket.addEventListener('error', () => {
      socket.close();
    });
  }

  private teardown() {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    const delay = Math.min(1000 * 2 ** this.reconnectAttempts, 15_000);
    this.reconnectAttempts += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.open();
    }, delay);
  }

  private send(msg: ClientOutboundMessage) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    this.socket.send(JSON.stringify(msg));
  }

  subscribe(printerIds: string[]) {
    this.subscribedIds = printerIds;
    this.send({ type: 'subscribe', payload: { printerIds } });
  }

  command(printerId: string, action: CommandAction) {
    this.send({ type: 'command', payload: { printerId, action } });
  }

  private ping() {
    this.send({ type: 'ping', payload: { ts: Date.now() } });
  }

  onMessage(fn: Listener) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  close() {
    this.closedByUser = true;
    this.teardown();
    this.socket?.close();
    this.socket = null;
  }
}
