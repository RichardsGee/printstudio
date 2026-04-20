import '../src/env-bootstrap.js';
import { createDb, printerState } from '@printstudio/db';
import { eq } from 'drizzle-orm';

const db = createDb(process.env.DATABASE_URL!);
const printerId = process.argv[2] ?? '3f0cf07b-40ab-4a5f-bc05-46c0e03b115f';
const rows = await db.select().from(printerState).where(eq(printerState.printerId, printerId));
console.log(JSON.stringify(rows[0], null, 2));
process.exit(0);
