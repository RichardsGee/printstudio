import { desc } from 'drizzle-orm';
import { createDb, printers } from '@printstudio/db';
import { DashboardClient } from './dashboard-client';

async function loadPrinters() {
  const url = process.env.DATABASE_URL;
  if (!url) return [];
  const db = createDb(url);
  const rows = await db
    .select({ id: printers.id, name: printers.name })
    .from(printers)
    .orderBy(desc(printers.createdAt))
    .limit(10);
  return rows;
}

export default async function DashboardPage() {
  const list = await loadPrinters();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Estado em tempo real das impressoras
        </p>
      </div>
      <DashboardClient printers={list} />
    </div>
  );
}
