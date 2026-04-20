import { EventEmitter } from 'node:events';
import type { PrinterConfig, PrinterState, PrinterEvent, CommandAction } from '@printstudio/shared';
import { PrinterClient } from './printer-client.js';
import type { Logger } from '../logger.js';

export class MqttManager extends EventEmitter {
  private clients = new Map<string, PrinterClient>();

  constructor(
    private readonly printers: PrinterConfig[],
    private readonly logger: Logger,
  ) {
    super();
  }

  start(): void {
    for (const printer of this.printers) {
      const client = new PrinterClient(printer, this.logger);
      client.on('state', (state: PrinterState) => this.emit('state', state));
      client.on('event', (event: PrinterEvent) => this.emit('event', event));
      this.clients.set(printer.id, client);
      client.connect();
    }
  }

  async stop(): Promise<void> {
    await Promise.all([...this.clients.values()].map((c) => c.disconnect()));
    this.clients.clear();
  }

  getAllStates(): PrinterState[] {
    return [...this.clients.values()].map((c) => c.getState());
  }

  getState(printerId: string): PrinterState | undefined {
    return this.clients.get(printerId)?.getState();
  }

  getPrinterConfigs(): PrinterConfig[] {
    return this.printers;
  }

  sendCommand(
    printerId: string,
    action: CommandAction,
  ): { commandId: string; ok: boolean; error?: string } {
    const client = this.clients.get(printerId);
    if (!client) return { commandId: '', ok: false, error: `printer ${printerId} not found` };
    return client.sendCommand(action);
  }
}
