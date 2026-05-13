import type { Metadata } from 'next';
import { PageHeader } from '@/components/ui/page-header';
import { listAdminAudit } from '@/lib/admin-audit-queries';
import { AuditFilters } from './_components/audit-filters';
import { AuditTable } from './_components/audit-table';
import { Pagination } from './_components/pagination';

export const metadata: Metadata = {
  title: 'Admin · Audit Log · PrintStudio',
  robots: { index: false, follow: false },
};

function parseCsv(raw: string | undefined): string[] | undefined {
  if (!raw) return undefined;
  const items = raw.split(',').map((s) => s.trim()).filter(Boolean);
  return items.length > 0 ? items : undefined;
}

interface PageSearchParams {
  action?: string;
  type?: string;
  cursor?: string;
}

/**
 * `/admin/audit` (Story 9.9) — Audit log read-only.
 *
 * Mostra todas as ações destrutivas registradas via `logAdminAction`
 * (Stories 9.3/9.4/9.6 já chamam).
 *
 * Filtros: action multi-select, target_type multi-select. URL state.
 * Paginação cursor-based.
 */
export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<PageSearchParams>;
}) {
  const params = await searchParams;
  const result = await listAdminAudit({
    action: parseCsv(params.action),
    targetType: parseCsv(params.type),
    cursor: params.cursor,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        id="ADMIN-AUDIT"
        title="Audit Log"
        description="Trail completo de ações destrutivas no Admin Panel. Read-only — não editável via UI."
        showTimestamp={false}
      />

      <AuditFilters
        knownActions={result.knownActions}
        knownTargetTypes={result.knownTargetTypes}
      />

      <AuditTable rows={result.rows} />

      <Pagination
        nextCursor={result.nextCursor}
        hasMore={result.hasMore}
        currentCount={result.rows.length}
      />
    </div>
  );
}
