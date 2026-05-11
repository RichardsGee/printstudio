import { asc, eq, sql } from 'drizzle-orm';
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
    // Ordem manual (display_order) tem prioridade; sem ordem → mais antigos
    // primeiro (asc createdAt) pra preservar consistência entre sessões.
    .orderBy(sql`${printers.displayOrder} ASC NULLS LAST`, asc(printers.createdAt))
    .limit(20);
  return rows;
}

export default async function KioskPage() {
  const orgId = await requireCurrentOrgId();
  const list = await loadPrinters(orgId);
  return <KioskClient printers={list} />;
}
