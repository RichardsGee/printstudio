import { desc, eq } from 'drizzle-orm';
import { createDb, printers } from '@printstudio/db';
import { requireCurrentOrgId } from '@/lib/current-org';
import { KioskClient } from './kiosk-client';

async function loadPrinters(organizationId: string) {
  const url = process.env.DATABASE_URL;
  if (!url) return [];
  const db = createDb(url);
  const rows = await db
    .select({ id: printers.id, name: printers.name })
    .from(printers)
    .where(eq(printers.organizationId, organizationId))
    .orderBy(desc(printers.createdAt))
    .limit(20);
  return rows;
}

export default async function KioskPage() {
  const orgId = await requireCurrentOrgId();
  const list = await loadPrinters(orgId);
  return <KioskClient printers={list} />;
}
