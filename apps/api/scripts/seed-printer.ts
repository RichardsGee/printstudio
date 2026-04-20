import { config as loadEnv } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
loadEnv({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../../../.env') });

import { createDb, printers, printerState } from '@printstudio/db';
import { eq } from 'drizzle-orm';

const name = process.argv[2];
const serial = process.argv[3];
const ip = process.argv[4];
const accessCode = process.argv[5];

if (!name || !serial || !ip || !accessCode) {
  console.error('Usage: tsx seed-printer.ts "<name>" <serial> <ip> <access_code>');
  process.exit(1);
}

const db = createDb(process.env.DATABASE_URL!);

const existing = await db.select().from(printers).where(eq(printers.serial, serial)).limit(1);

let printerId: string;

if (existing.length > 0) {
  printerId = existing[0]!.id;
  await db
    .update(printers)
    .set({ name, ipAddress: ip, accessCode, updatedAt: new Date() })
    .where(eq(printers.id, printerId));
  console.log(`Updated printer: ${name}`);
} else {
  const [inserted] = await db
    .insert(printers)
    .values({ name, serial, ipAddress: ip, accessCode, model: 'A1' })
    .returning({ id: printers.id });
  printerId = inserted!.id;
  console.log(`Created printer: ${name}`);
}

const hasState = await db
  .select()
  .from(printerState)
  .where(eq(printerState.printerId, printerId))
  .limit(1);

if (hasState.length === 0) {
  await db.insert(printerState).values({ printerId, status: 'OFFLINE' });
  console.log('Initialized printer_state row (OFFLINE)');
}

console.log('');
console.log('Printer ID:  ', printerId);
console.log('Name:        ', name);
console.log('Serial:      ', serial);
console.log('IP:          ', ip);
console.log('Access Code: ', accessCode);
console.log('');
console.log('→ Add this to .env:');
console.log(`PRINTER_1_ID=${printerId}`);

process.exit(0);
