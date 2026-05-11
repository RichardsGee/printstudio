import { asc, eq, sql } from 'drizzle-orm';
import { createDb, printers } from '@printstudio/db';
import { PageHeader } from '@/components/ui/page-header';
import { requireCurrentOrgId } from '@/lib/current-org';
import { DashboardClient } from './dashboard-client';

async function loadPrinters(organizationId: string) {
  const url = process.env.DATABASE_URL;
  if (!url) return [];
  const db = createDb(url);
  const rows = await db
    .select({ id: printers.id, name: printers.name })
    .from(printers)
    .where(eq(printers.organizationId, organizationId))
    .orderBy(sql`${printers.displayOrder} ASC NULLS LAST`, asc(printers.createdAt))
    .limit(10);
  return rows;
}

export default async function DashboardPage() {
  const orgId = await requireCurrentOrgId();
  const list = await loadPrinters(orgId);
  return (
    <div className="space-y-6">
      <PageHeader
        id="DASHBOARD"
        title="Dashboard"
        description="Estado em tempo real das impressoras"
      />
      <DashboardClient printers={list} />
    </div>
  );
}
