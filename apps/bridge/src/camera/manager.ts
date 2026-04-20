import type { PrinterConfig } from '@printstudio/shared';
import type { Logger } from '../logger.js';
import { BambuCameraClient } from './bambu-camera.js';

/**
 * Manages one BambuCameraClient per printer. Clients are lazy — they only
 * connect when the first HTTP consumer starts streaming, and disconnect
 * when the last consumer leaves (to avoid wasting bandwidth / printer CPU).
 */
export class CameraManager {
  private readonly clients = new Map<string, BambuCameraClient>();
  private readonly latestFrames = new Map<string, Buffer>();
  private readonly consumerCounts = new Map<string, number>();

  constructor(
    private readonly printers: PrinterConfig[],
    private readonly logger: Logger,
  ) {}

  private getOrCreate(printerId: string): BambuCameraClient | null {
    if (this.clients.has(printerId)) return this.clients.get(printerId)!;

    const printer = this.printers.find((p) => p.id === printerId);
    if (!printer || !printer.ipAddress) {
      this.logger.warn({ printerId }, 'camera: printer not found or no IP');
      return null;
    }

    const client = new BambuCameraClient(printer.ipAddress, printer.accessCode, this.logger);
    client.on('frame', (jpeg: Buffer) => {
      this.latestFrames.set(printerId, jpeg);
    });
    this.clients.set(printerId, client);
    return client;
  }

  /**
   * Register a consumer; connects on first one, returns an unsubscribe fn.
   */
  acquire(printerId: string): () => void {
    const client = this.getOrCreate(printerId);
    if (!client) return () => {};

    const prev = this.consumerCounts.get(printerId) ?? 0;
    this.consumerCounts.set(printerId, prev + 1);
    if (prev === 0) {
      this.logger.info({ printerId }, 'camera: first consumer, starting stream');
      client.start();
    }

    let released = false;
    return () => {
      if (released) return;
      released = true;
      const current = this.consumerCounts.get(printerId) ?? 0;
      const next = Math.max(0, current - 1);
      this.consumerCounts.set(printerId, next);
      if (next === 0) {
        this.logger.info({ printerId }, 'camera: no more consumers, stopping stream');
        client.stop();
        this.clients.delete(printerId);
        this.latestFrames.delete(printerId);
      }
    };
  }

  /**
   * Subscribe to frames. Returns an unsubscribe fn — caller MUST also call
   * acquire()'s release fn to close the underlying stream if appropriate.
   */
  onFrame(printerId: string, handler: (jpeg: Buffer) => void): () => void {
    const client = this.clients.get(printerId);
    if (!client) return () => {};
    client.on('frame', handler);
    return () => client.off('frame', handler);
  }

  getLatestFrame(printerId: string): Buffer | null {
    return this.latestFrames.get(printerId) ?? null;
  }

  stopAll(): void {
    for (const client of this.clients.values()) client.stop();
    this.clients.clear();
    this.latestFrames.clear();
    this.consumerCounts.clear();
  }
}
