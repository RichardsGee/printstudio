import type { Metadata } from 'next';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { PLAN_KEYS, type PlanKey } from '@printstudio/shared';
import {
  getAdminOrgsMetrics,
  listAdminOrgs,
} from '@/lib/admin-orgs-queries';
import { ExportCsvButton } from '@/components/admin/export-csv-button';
import { OrgsFilters } from './_components/orgs-filters';
import { OrgsTable } from './_components/orgs-table';
import { Pagination } from './_components/pagination';

export const metadata: Metadata = {
  title: 'Admin · Orgs · PrintStudio',
  robots: { index: false, follow: false },
};

function parsePlans(raw: string | undefined): PlanKey[] | undefined {
  if (!raw) return undefined;
  const allowed = new Set<string>(PLAN_KEYS);
  const items = raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => allowed.has(s)) as PlanKey[];
  return items.length > 0 ? items : undefined;
}

interface PageSearchParams {
  plan?: string;
  q?: string;
  cursor?: string;
}

/**
 * `/admin/orgs` (Story 9.5).
 *
 * Lista todas as organizações com:
 * - Métricas top (total, onboarded %, distribuição plano)
 * - Filtros (busca por nome/email + plano multi-select)
 * - Tabela paginada cursor-based
 * - Click row → /admin/orgs/[id] (Story 9.6)
 *
 * Layout pai garante super_admin (Story 9.1).
 */
export default async function AdminOrgsPage({
  searchParams,
}: {
  searchParams: Promise<PageSearchParams>;
}) {
  const params = await searchParams;
  const filters = {
    plan: parsePlans(params.plan),
    q: params.q,
    cursor: params.cursor,
  };

  const [list, metrics] = await Promise.all([
    listAdminOrgs(filters),
    getAdminOrgsMetrics(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        id="ADMIN-ORGS"
        title="Users · Orgs"
        description={`${metrics.total} organização${metrics.total === 1 ? '' : 'ões'} cadastrada${metrics.total === 1 ? '' : 's'}.`}
        showTimestamp={false}
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="TOTAL" value={metrics.total} />
        <MetricCard
          label="ONBOARDED"
          value={metrics.onboarded}
          hint={`${metrics.onboardedPct.toFixed(1)}%`}
        />
        <MetricCard label="FREE" value={metrics.byPlan.free ?? 0} />
        <MetricCard
          label="PAID"
          value={(metrics.byPlan.pro ?? 0) + (metrics.byPlan.business ?? 0)}
          hint={`pro ${metrics.byPlan.pro ?? 0} · biz ${metrics.byPlan.business ?? 0}`}
        />
      </div>

      <div className="flex items-center justify-end">
        <ExportCsvButton endpoint="/api/admin/export/orgs" />
      </div>

      <OrgsFilters planCounts={metrics.byPlan} />

      <OrgsTable rows={list.rows} />

      <Pagination
        nextCursor={list.nextCursor}
        hasMore={list.hasMore}
        currentCount={list.rows.length}
      />
    </div>
  );
}

function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint?: string;
}) {
  return (
    <Card data-mc-card>
      <CardHeader className="pb-2">
        <p
          data-mc-id
          className="text-caption font-mono uppercase tracking-wider text-muted-foreground"
        >
          {`// ${label}`}
        </p>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-2">
          <span data-mc-num className="text-3xl font-semibold">
            {value}
          </span>
          {hint && (
            <span className="text-caption text-muted-foreground">{hint}</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
