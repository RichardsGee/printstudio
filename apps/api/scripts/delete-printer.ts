import '../src/env-bootstrap.js';
import { createDb, printers } from '@printstudio/db';
import { eq } from 'drizzle-orm';

const id = process.argv[2];
if (!id) {
  console.error('Usage: tsx scripts/delete-printer.ts <printer-id>');
  process.exit(1);
}

const db = createDb(process.env.DATABASE_URL!);
const deleted = await db.delete(printers).where(eq(printers.id, id)).returning();
console.log('Deleted:', deleted);
process.exit(0);
