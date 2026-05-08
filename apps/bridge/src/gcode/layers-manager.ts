import type { PrinterConfig, PrinterState } from '@printstudio/shared';
import type { Logger } from '../logger.js';
import { ThumbnailFetcher } from '../ftp/thumbnail-fetcher.js';
import { parseGcodeToLayers, simplifyLayers, type LayersData } from './parser.js';

interface CachedLayers {
  fileName: string;
  data: LayersData;
  fetchedAt: number;
}

// Backoff entre retentativas quando a impressora ainda não subiu o .3mf
// pro FTP — começa em 5s e dobra até um teto de 5min.
const RETRY_MIN_MS = 5_000;
const RETRY_MAX_MS = 300_000;

/**
 * Como o `ThumbnailManager`, mas cachea a representação por camadas
 * derivada do gcode embutido no .3mf. Faz dedup de fetches e refaz o
 * parse apenas quando o `currentFile` muda — com retry exponencial
 * caso o arquivo ainda não esteja disponível no FTP (a impressora
 * demora alguns segundos pra subir o .3mf quando inicia um trabalho).
 */
export class LayersManager {
  private readonly cache = new Map<string, CachedLayers>();
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
    if (prior === fileName) return; // já estamos atrás desse arquivo
    this.targetFile.set(state.printerId, fileName);
    this.retryDelay.delete(state.printerId);
    this.cancelRetry(state.printerId);

    const cached = this.cache.get(state.printerId);
    if (cached && cached.fileName === fileName) return; // já temos

    if (this.inFlight.has(state.printerId)) return;
    void this.fetchAndParse(state.printerId, fileName);
  }

  private cancelRetry(printerId: string): void {
    const t = this.retryTimer.get(printerId);
    if (t) {
      clearTimeout(t);
      this.retryTimer.delete(printerId);
    }
  }

  private scheduleRetry(printerId: string, fileName: string): void {
    // Só reagenda enquanto o alvo atual continuar sendo esse fileName.
    const prev = this.retryDelay.get(printerId) ?? RETRY_MIN_MS;
    const next = Math.min(prev * 2, RETRY_MAX_MS);
    this.retryDelay.set(printerId, next);
    this.cancelRetry(printerId);
    const t = setTimeout(() => {
      this.retryTimer.delete(printerId);
      if (this.targetFile.get(printerId) !== fileName) return;
      if (this.inFlight.has(printerId)) return;
      void this.fetchAndParse(printerId, fileName);
    }, prev);
    this.retryTimer.set(printerId, t);
    this.logger.info(
      { printerId, fileName, retryInMs: prev },
      'layers: retry scheduled',
    );
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
        this.logger.warn({ printerId, fileName }, 'layers: .3mf not available yet, will retry');
        this.scheduleRetry(printerId, fileName);
        return;
      }
      const started = Date.now();
      const raw = parseGcodeToLayers(payload.gcode);
      // 0.25mm de threshold — pra um display de ~600px num modelo de
      // ~200mm a resolução efetiva é ~0.3mm/px. Simplificação maior
      // que isso já é sub-pixel e só pesa o DOM.
      const simplified = simplifyLayers(raw, 0.25);
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
      this.retryDelay.delete(printerId);
    } catch (err) {
      this.logger.warn(
        { printerId, err: err instanceof Error ? err.message : String(err) },
        'layers: unexpected error, will retry',
      );
      this.scheduleRetry(printerId, fileName);
    } finally {
      this.inFlight.delete(printerId);
    }
  }

  get(printerId: string): CachedLayers | null {
    return this.cache.get(printerId) ?? null;
  }
}
