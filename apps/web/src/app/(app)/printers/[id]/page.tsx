import { notFound } from 'next/navigation';
import { and, eq } from 'drizzle-orm';
import { createDb, printers } from '@printstudio/db';
import { requireCurrentOrgId } from '@/lib/current-org';
import { PrinterDetailClient } from './printer-detail-client';

async function loadPrinter(id: string, organizationId: string) {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  const db = createDb(url);
  const rows = await db
    .select()
    .from(printers)
    .where(and(eq(printers.id, id), eq(printers.organizationId, organizationId)))
    .limit(1);
  return rows[0] ?? null;
}

export default async function PrinterDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const orgId = await requireCurrentOrgId();
  const printer = await loadPrinter(id, orgId);
  if (!printer) notFound();

  return <PrinterDetailClient printerId={printer.id} name={printer.name} />;
}
