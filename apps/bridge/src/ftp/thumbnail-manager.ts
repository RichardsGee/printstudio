import type { PrinterConfig, PrinterState } from '@printstudio/shared';
import type { Logger } from '../logger.js';
import { ThumbnailFetcher } from './thumbnail-fetcher.js';

interface CachedThumb {
  fileName: string;
  image: Buffer;
  fetchedAt: number;
}

const RETRY_MIN_MS = 5_000;
const RETRY_MAX_MS = 300_000;

/**
 * Cache em memória da última thumbnail de cada printer. Refaz o fetch
 * quando `currentFile` muda, e reagenda com backoff exponencial quando
 * a impressora ainda não subiu o .3mf pro FTP (costuma levar alguns
 * segundos após o início da impressão).
 */
export class ThumbnailManager {
  private readonly cache = new Map<string, CachedThumb>();
  private readonly inFlight = new Set<string>();
  private readonly targetFile = new Map<string, string>();
  private readonly retryTimer = new Map<string, NodeJS.Timeout>();
  private readonly retryDelay = new Map<string, number>();

  constructor(
    private readonly printers: PrinterConfig[],
    private readonly logger: Logger,
  ) {}

  onState(state: PrinterState): void {
    const fileName = state.currentFile;
    if (!fileName) {
      this.targetFile.delete(state.printerId);
      this.cancelRetry(state.printerId);
      return;
    }
    const prior = this.targetFile.get(state.printerId);
    if (prior === fileName) return;
    this.targetFile.set(state.printerId, fileName);
    this.retryDelay.delete(state.printerId);
    this.cancelRetry(state.printerId);

    const cached = this.cache.get(state.printerId);
    if (cached && cached.fileName === fileName) return;

    if (this.inFlight.has(state.printerId)) return;
    void this.fetch(state.printerId, fileName);
  }

  private cancelRetry(printerId: string): void {
    const t = this.retryTimer.get(printerId);
    if (t) {
      clearTimeout(t);
      this.retryTimer.delete(printerId);
    }
  }

  private scheduleRetry(printerId: string, fileName: string): void {
    const prev = this.retryDelay.get(printerId) ?? RETRY_MIN_MS;
    const next = Math.min(prev * 2, RETRY_MAX_MS);
    this.retryDelay.set(printerId, next);
    this.cancelRetry(printerId);
    const t = setTimeout(() => {
      this.retryTimer.delete(printerId);
      if (this.targetFile.get(printerId) !== fileName) return;
      if (this.inFlight.has(printerId)) return;
      void this.fetch(printerId, fileName);
    }, prev);
    this.retryTimer.set(printerId, t);
  }

  private async fetch(printerId: string, fileName: string): Promise<void> {
    const printer = this.printers.find((p) => p.id === printerId);
    if (!printer || !printer.ipAddress) return;

    this.inFlight.add(printerId);
    const fetcher = new ThumbnailFetcher(printer.ipAddress, printer.accessCode, this.logger);
    try {
      this.logger.info({ printerId, fileName }, 'thumbnail: fetching');
      const image = await fetcher.fetchLatestThumbnail(fileName);
      if (image) {
        this.cache.set(printerId, { fileName, image, fetchedAt: Date.now() });
        this.retryDelay.delete(printerId);
      } else {
        this.logger.warn({ printerId, fileName }, 'thumbnail: not available, will retry');
        this.scheduleRetry(printerId, fileName);
      }
    } catch (err) {
      this.logger.warn(
        { printerId, err: err instanceof Error ? err.message : String(err) },
        'thumbnail: error, will retry',
      );
      this.scheduleRetry(printerId, fileName);
    } finally {
      this.inFlight.delete(printerId);
    }
  }

  get(printerId: string): { image: Buffer; fileName: string; fetchedAt: number } | null {
    return this.cache.get(printerId) ?? null;
  }
}
