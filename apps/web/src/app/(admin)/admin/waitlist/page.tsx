import type { Metadata } from 'next';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { BR_STATES } from '@printstudio/shared';
import {
  listWaitlist,
  getWaitlistMetrics,
  WAITLIST_STATUS_VALUES,
  WAITLIST_ROLE_VALUES,
  type WaitlistRoleValue,
  type WaitlistStatusValue,
} from '@/lib/waitlist-queries';
import { WaitlistFilters } from './_components/waitlist-filters';
import { WaitlistTable } from './_components/waitlist-table';
import { Pagination } from './_components/pagination';

export const metadata: Metadata = {
  title: 'Admin · Waitlist · PrintStudio',
  robots: { index: false, follow: false },
};

function parseList<T extends string>(
  raw: string | undefined,
  allowed: readonly T[],
): T[] | undefined {
  if (!raw) return undefined;
  const items = raw.split(',').map((s) => s.trim()).filter(Boolean) as T[];
  const allowedSet = new Set<string>(allowed);
  const filtered = items.filter((s) => allowedSet.has(s));
  return filtered.length > 0 ? filtered : undefined;
}

interface PageSearchParams {
  status?: string;
  role?: string;
  state?: string;
  q?: string;
  cursor?: string;
}

/**
 * `/admin/waitlist` (Story 9.3).
 *
 * Server Component:
 * - Parse `searchParams` em filtros tipados
 * - Query paginada via `listWaitlist` (cursor-based)
 * - Métricas via `getWaitlistMetrics` (cards no topo)
 * - Renderiza filtros (client) + tabela (client interativa)
 *
 * URL state: filtros viram query params (shareable).
 * Layout pai garante super_admin (Story 9.1).
 */
export default async function AdminWaitlistPage({
  searchParams,
}: {
  searchParams: Promise<PageSearchParams>;
}) {
  const params = await searchParams;

  const filters = {
    status: parseList<WaitlistStatusValue>(params.status, WAITLIST_STATUS_VALUES),
    role: parseList<WaitlistRoleValue>(params.role, WAITLIST_ROLE_VALUES),
    state: parseList<string>(params.state, BR_STATES),
    q: params.q,
    cursor: params.cursor,
  };

  const [list, metrics] = await Promise.all([
    listWaitlist(filters),
    getWaitlistMetrics(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        id="ADMIN-WAITLIST"
        title="Waitlist"
        description={`${metrics.total} leads cadastrados. ${metrics.newLast7d} novos nos últimos 7 dias.`}
        showTimestamp={false}
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="TOTAL" value={metrics.total} />
        <MetricCard label="NOVOS · 7D" value={metrics.newLast7d} />
        <MetricCard
          label="CONVERTIDOS"
          value={metrics.converted}
          hint={
            metrics.total > 0
              ? `${((metrics.converted / metrics.total) * 100).toFixed(1)}%`
              : '—'
          }
        />
        <MetricCard label="NEW · STATUS" value={metrics.byStatus.new ?? 0} />
      </div>

      <WaitlistFilters
        statusValues={WAITLIST_STATUS_VALUES}
        roleValues={WAITLIST_ROLE_VALUES}
        stateValues={BR_STATES}
        statusCounts={metrics.byStatus}
      />

      <WaitlistTable rows={list.rows} />

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
            <span className="text-small text-muted-foreground">{hint}</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
