import { asc, eq, sql } from 'drizzle-orm';
import { createDb, printers } from '@printstudio/db';
import { PageHeader } from '@/components/ui/page-header';
import { requireCurrentOrgId } from '@/lib/current-org';
import { PrintersAdminClient } from './printers-client';

async function loadPrinters(organizationId: string) {
  const url = process.env.DATABASE_URL;
  if (!url) return [];
  const db = createDb(url);
  return db
    .select({
      id: printers.id,
      name: printers.name,
      serial: printers.serial,
      model: printers.model,
      displayOrder: printers.displayOrder,
      createdAt: printers.createdAt,
    })
    .from(printers)
    .where(eq(printers.organizationId, organizationId))
    .orderBy(sql`${printers.displayOrder} ASC NULLS LAST`, asc(printers.createdAt));
}

export default async function PrintersAdminPage() {
  const orgId = await requireCurrentOrgId();
  const list = await loadPrinters(orgId);

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        id="PRINTERS"
        title="Impressoras"
        description="Gerencie nomes, ordem e remoção das impressoras vinculadas à organização."
      />
      <PrintersAdminClient
        printers={list.map((p) => ({
          ...p,
          createdAt: p.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
