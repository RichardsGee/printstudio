import { createHash } from 'node:crypto';
import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';
import type { PrinterConfig } from '@printstudio/shared';

loadDotenv();

const EnvSchema = z.object({
  NODE_ENV: z.string().default('development'),
  LOG_LEVEL: z.string().default('info'),
  BRIDGE_PORT: z.coerce.number().int().positive().default(8080),
  BRIDGE_MDNS_NAME: z.string().default('printstudio.local'),
  BRIDGE_ID: z.string().default('bridge-local-01'),
  BRIDGE_DB_PATH: z.string().default('./data/bridge.db'),
  CLOUD_WS_URL: z.string().url().optional(),
  CLOUD_API_TOKEN: z.string().optional(),
  GO2RTC_PORT: z.coerce.number().int().positive().default(1984),
});

export type BridgeEnv = z.infer<typeof EnvSchema>;

export interface BridgeConfig {
  env: BridgeEnv;
  printers: PrinterConfig[];
}

// Deterministic UUID v5-ish derived from the printer serial.
// Keeps the same printerId across restarts without requiring explicit env.
function serialToUuid(serial: string): string {
  const hash = createHash('sha1').update(`printstudio:printer:${serial}`).digest('hex');
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    // Force version 5 marker (high nibble = 5)
    '5' + hash.slice(13, 16),
    // Force RFC 4122 variant (high bits = 10xx → 8,9,a,b)
    ((parseInt(hash.slice(16, 18), 16) & 0x3f) | 0x80).toString(16).padStart(2, '0') + hash.slice(18, 20),
    hash.slice(20, 32),
  ].join('-');
}

function readPrintersFromEnv(): PrinterConfig[] {
  const printers: PrinterConfig[] = [];
  for (let i = 1; i <= 3; i++) {
    const serial = process.env[`PRINTER_${i}_SERIAL`];
    const accessCode = process.env[`PRINTER_${i}_ACCESS_CODE`];
    if (!serial || !accessCode || serial === 'CHANGE_ME' || accessCode === 'CHANGE_ME') {
      continue;
    }
    const rawId = process.env[`PRINTER_${i}_ID`];
    const id = rawId && rawId.length > 0 ? rawId : serialToUuid(serial);
    const name = process.env[`PRINTER_${i}_NAME`] ?? `A1 #${i}`;
    const ipAddress = process.env[`PRINTER_${i}_IP`];
    printers.push({
      id,
      name,
      serial,
      accessCode,
      ipAddress: ipAddress && ipAddress.length > 0 ? ipAddress : undefined,
      model: 'A1',
    });
  }
  return printers;
}

export function loadConfig(): BridgeConfig {
  const env = EnvSchema.parse(process.env);
  const printers = readPrintersFromEnv();
  return { env, printers };
}
