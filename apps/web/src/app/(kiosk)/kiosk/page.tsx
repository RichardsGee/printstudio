import { desc } from 'drizzle-orm';
import { createDb, printers } from '@printstudio/db';
import { KioskClient } from './kiosk-client';

async function loadPrinters() {
  const url = process.env.DATABASE_URL;
  if (!url) return [];
  const db = createDb(url);
  const rows = await db
    .select({ id: printers.id, name: printers.name })
    .from(printers)
    .orderBy(desc(printers.createdAt))
    .limit(20);
  return rows;
}

export default async function KioskPage() {
  const list = await loadPrinters();
  return <KioskClient printers={list} />;
}
