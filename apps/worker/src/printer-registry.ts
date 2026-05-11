import { and, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { printers } from '@printstudio/db';
import { config } from './config.js';
import { logger } from './logger.js';
import type { BambuBoundDevice } from './bambu-cloud-api.js';

const sql = postgres(config.DATABASE_URL, { max: 2 });
const db = drizzle(sql);

export interface RegisteredPrinter {
  printerId: string; // UUID interno PrintStudio
  serial: string; // dev_id Bambu (FK natural)
  name: string;
}

/**
 * Pra cada device retornado pela Bambu Cloud, garante que existe uma
 * linha em `printers` da org. Faz UPSERT por serial (chave única).
 *
 * NOTE: `access_code` é NOT NULL no schema mas em cloud-mode não tem
 * significado (a auth é via JWT no MQTT). Setamos string vazia. Em uma
 * story futura podemos tornar access_code nullable.
 */
export async function syncPrintersWithCloud(
  devices: BambuBoundDevice[],
): Promise<RegisteredPrinter[]> {
  const registered: RegisteredPrinter[] = [];

  for (const d of devices) {
    const existing = await db
      .select({ id: printers.id, name: printers.name })
      .from(printers)
      .where(and(eq(printers.organizationId, config.ORGANIZATION_ID), eq(printers.serial, d.serial)))
      .limit(1);

    if (existing[0]) {
      registered.push({
        printerId: existing[0].id,
        serial: d.serial,
        name: existing[0].name,
      });
      continue;
    }

    // Cria nova linha pra serial não conhecido
    const inserted = await db
      .insert(printers)
      .values({
        organizationId: config.ORGANIZATION_ID,
        name: d.name || `Bambu ${d.productName}`,
        serial: d.serial,
        accessCode: '', // cloud-managed — auth via JWT no MQTT, não usa access_code
        model: d.productName,
      })
      .returning({ id: printers.id, name: printers.name });

    if (inserted[0]) {
      logger.info(
        { serial: d.serial, printerId: inserted[0].id, name: inserted[0].name },
        'novo printer registrado a partir do Bambu Cloud',
      );
      registered.push({
        printerId: inserted[0].id,
        serial: d.serial,
        name: inserted[0].name,
      });
    }
  }

  return registered;
}

export async function closeDb(): Promise<void> {
  await sql.end();
}
