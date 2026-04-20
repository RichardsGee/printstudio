import '../src/env-bootstrap.js';
import { createDb, printers } from '@printstudio/db';

const db = createDb(process.env.DATABASE_URL!);
const rows = await db.select().from(printers);
console.log(JSON.stringify(rows, null, 2));
process.exit(0);
