import { Bonjour, type Service } from 'bonjour-service';
import type { Logger } from './logger.js';

export class MdnsPublisher {
  private bonjour = new Bonjour();
  private service: Service | null = null;

  constructor(private readonly logger: Logger) {}

  publish(opts: { name: string; port: number }): void {
    // Strip a trailing '.local' so bonjour-service doesn't double-append it.
    const name = opts.name.replace(/\.local\.?$/i, '');
    try {
      this.service = this.bonjour.publish({
        name,
        type: 'http',
        port: opts.port,
        txt: { app: 'printstudio', mode: 'bridge' },
      });
      this.logger.info({ name, port: opts.port }, 'mDNS published');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown';
      this.logger.warn({ err: msg }, 'mDNS publish failed');
    }
  }

  async unpublish(): Promise<void> {
    const service = this.service;
    if (service) {
      await new Promise<void>((resolve) => {
        const stop = service.stop as ((cb: () => void) => void) | undefined;
        if (typeof stop === 'function') stop.call(service, () => resolve());
        else resolve();
      });
      this.service = null;
    }
    this.bonjour.destroy();
  }
}
