import type { PrinterConfig, PrinterState } from '@printstudio/shared';
import type { Logger } from '../logger.js';
import { ThumbnailFetcher } from './thumbnail-fetcher.js';

interface CachedThumb {
  fileName: string;
  image: Buffer;
  fetchedAt: number;
}

/**
 * Keeps the latest plate-render thumbnail per printer cached in memory.
 * Refetches whenever the active `currentFile` changes.
 *
 * Lazy and throttled — only actually hits the printer when (a) a new file
 * is reported and (b) we don't already have a cached thumb for that file.
 */
export class ThumbnailManager {
  private readonly cache = new Map<string, CachedThumb>();
  private readonly inFlight = new Set<string>();
  private readonly lastFile = new Map<string, string>();

  constructor(
    private readonly printers: PrinterConfig[],
    private readonly logger: Logger,
  ) {}

  /** Call whenever a state update is received for a printer. */
  onState(state: PrinterState): void {
    const fileName = state.currentFile;
    if (!fileName) {
      this.lastFile.delete(state.printerId);
      return;
    }
    const prior = this.lastFile.get(state.printerId);
    if (prior === fileName) return; // nothing new to fetch
    this.lastFile.set(state.printerId, fileName);

    const cached = this.cache.get(state.printerId);
    if (cached && cached.fileName === fileName) return; // already cached

    if (this.inFlight.has(state.printerId)) return; // dedupe parallel fetches
    void this.fetch(state.printerId, fileName);
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
      } else {
        this.logger.warn({ printerId, fileName }, 'thumbnail: fetch returned null');
      }
    } catch (err) {
      this.logger.warn(
        { printerId, err: err instanceof Error ? err.message : String(err) },
        'thumbnail: unexpected error',
      );
    } finally {
      this.inFlight.delete(printerId);
    }
  }

  get(printerId: string): { image: Buffer; fileName: string; fetchedAt: number } | null {
    return this.cache.get(printerId) ?? null;
  }
}
