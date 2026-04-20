import type { PrinterConfig, PrinterState } from '@printstudio/shared';
import type { Logger } from '../logger.js';
import { ThumbnailFetcher } from '../ftp/thumbnail-fetcher.js';
import { parseGcodeToLayers, simplifyLayers, type LayersData } from './parser.js';

interface CachedLayers {
  fileName: string;
  data: LayersData;
  fetchedAt: number;
}

/**
 * Como o `ThumbnailManager`, mas cachea a representação por camadas
 * derivada do gcode embutido no .3mf. Faz dedup de fetches e refaz o
 * parse apenas quando o `currentFile` muda.
 *
 * O parse é síncrono mas pode ser pesado (milhares de linhas) — fica
 * dentro de um `try/finally` que libera o slot `inFlight` em qualquer
 * desfecho.
 */
export class LayersManager {
  private readonly cache = new Map<string, CachedLayers>();
  private readonly inFlight = new Set<string>();
  private readonly lastFile = new Map<string, string>();

  constructor(
    private readonly printers: PrinterConfig[],
    private readonly logger: Logger,
  ) {}

  onState(state: PrinterState): void {
    const fileName = state.currentFile;
    if (!fileName) {
      this.lastFile.delete(state.printerId);
      return;
    }
    const prior = this.lastFile.get(state.printerId);
    if (prior === fileName) return;
    this.lastFile.set(state.printerId, fileName);

    const cached = this.cache.get(state.printerId);
    if (cached && cached.fileName === fileName) return;

    if (this.inFlight.has(state.printerId)) return;
    void this.fetchAndParse(state.printerId, fileName);
  }

  private async fetchAndParse(printerId: string, fileName: string): Promise<void> {
    const printer = this.printers.find((p) => p.id === printerId);
    if (!printer || !printer.ipAddress) return;

    this.inFlight.add(printerId);
    const fetcher = new ThumbnailFetcher(printer.ipAddress, printer.accessCode, this.logger);
    try {
      this.logger.info({ printerId, fileName }, 'layers: fetching .3mf for gcode');
      const payload = await fetcher.fetchLatest3mf(fileName);
      if (!payload?.gcode) {
        this.logger.warn({ printerId, fileName }, 'layers: no gcode in .3mf');
        return;
      }
      const started = Date.now();
      const raw = parseGcodeToLayers(payload.gcode);
      const simplified = simplifyLayers(raw, 0.08);
      const elapsed = Date.now() - started;
      this.logger.info(
        {
          printerId,
          fileName,
          layers: simplified.totalLayers,
          parseMs: elapsed,
          bounds: simplified.bounds,
        },
        'layers: parsed',
      );
      this.cache.set(printerId, { fileName, data: simplified, fetchedAt: Date.now() });
    } catch (err) {
      this.logger.warn(
        { printerId, err: err instanceof Error ? err.message : String(err) },
        'layers: unexpected error',
      );
    } finally {
      this.inFlight.delete(printerId);
    }
  }

  get(printerId: string): CachedLayers | null {
    return this.cache.get(printerId) ?? null;
  }
}
