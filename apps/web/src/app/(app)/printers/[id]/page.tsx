import { notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { createDb, printers } from '@printstudio/db';
import { PrinterDetailClient } from './printer-detail-client';

async function loadPrinter(id: string) {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  const db = createDb(url);
  const rows = await db.select().from(printers).where(eq(printers.id, id)).limit(1);
  return rows[0] ?? null;
}

export default async function PrinterDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const printer = await loadPrinter(id);
  if (!printer) notFound();

  return <PrinterDetailClient printerId={printer.id} name={printer.name} />;
}
