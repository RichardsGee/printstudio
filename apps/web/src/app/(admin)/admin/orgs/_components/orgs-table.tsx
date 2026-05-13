import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import type { AdminOrgRow } from '@/lib/admin-orgs-queries';
import { cn } from '@/lib/utils';

interface OrgsTableProps {
  rows: AdminOrgRow[];
}

const PLAN_BADGE: Record<string, string> = {
  free: 'border-zinc-500/40 bg-zinc-500/10 text-zinc-300',
  pro: 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300',
  business: 'border-primary/40 bg-primary/10 text-primary',
};

const STEP_LABELS: Record<string, string> = {
  profile: 'Step 1',
  bambu_connect: 'Step 2',
  printers: 'Step 3',
  done: 'Concluído',
  skipped: 'Pulado',
};

function formatDate(d: Date): string {
  return new Date(d).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  });
}

/**
 * Lista de orgs (Story 9.5). Server Component — rows pré-fetched via
 * `listAdminOrgs`. Click numa linha leva pra `/admin/orgs/[id]` (drill
 * down implementado na Story 9.6).
 */
export function OrgsTable({ rows }: OrgsTableProps) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-[var(--mc-accent-soft)]/30 bg-card/40 p-8 text-center">
        <p
          data-mc-id
          className="text-caption font-mono uppercase tracking-wider text-muted-foreground"
        >
          {'// NO ORGS · NO FILTERS MATCH'}
        </p>
        <p className="mt-2 text-small text-muted-foreground">
          Nenhuma organização encontrada com os filtros aplicados.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="hidden overflow-hidden rounded-lg border border-[var(--mc-accent-soft)]/30 lg:block">
        <table className="w-full text-small">
          <thead className="bg-card/40 text-caption uppercase tracking-wider text-muted-foreground">
            <tr>
              <Th>Organização</Th>
              <Th>Owner</Th>
              <Th>Plano</Th>
              <Th>Onboarding</Th>
              <Th>Printers</Th>
              <Th>Criada</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                className="border-t border-[var(--mc-accent-soft)]/20 transition-colors hover:bg-card/30"
              >
                <Td>
                  <Link
                    href={`/admin/orgs/${row.id}`}
                    className="block font-medium hover:text-primary"
                  >
                    {row.name}
                  </Link>
                </Td>
                <Td>
                  <div className="space-y-0.5">
                    {row.ownerName && (
                      <div className="text-caption">{row.ownerName}</div>
                    )}
                    <div className="text-caption text-muted-foreground font-mono">
                      {row.ownerEmail}
                    </div>
                  </div>
                </Td>
                <Td>
                  <Badge
                    variant="outline"
                    className={cn(
                      'font-mono uppercase tracking-wider',
                      PLAN_BADGE[row.plan],
                    )}
                  >
                    {row.plan}
                  </Badge>
                </Td>
                <Td>
                  <span
                    className={cn(
                      'text-caption',
                      row.onboardingCompletedAt ? 'text-primary' : 'text-muted-foreground',
                    )}
                  >
                    {STEP_LABELS[row.onboardingStep] ?? row.onboardingStep}
                  </span>
                </Td>
                <Td>
                  <span data-mc-num className="font-mono">
                    {row.printerCount}
                  </span>
                </Td>
                <Td>
                  <span data-mc-num className="font-mono text-caption text-muted-foreground">
                    {formatDate(row.createdAt)}
                  </span>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 lg:hidden">
        {rows.map((row) => (
          <Link
            key={row.id}
            href={`/admin/orgs/${row.id}`}
            data-mc-card
            className="block space-y-2 rounded-lg border border-[var(--mc-accent-soft)]/30 bg-card/40 p-4 transition-colors hover:border-primary/40"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-0.5 min-w-0">
                <div className="font-medium truncate">{row.name}</div>
                <div className="text-caption text-muted-foreground font-mono truncate">
                  {row.ownerEmail}
                </div>
              </div>
              <Badge
                variant="outline"
                className={cn(
                  'font-mono uppercase tracking-wider',
                  PLAN_BADGE[row.plan],
                )}
              >
                {row.plan}
              </Badge>
            </div>
            <div className="grid grid-cols-3 gap-2 text-caption">
              <div>
                <span
                  data-mc-label
                  className="text-muted-foreground uppercase tracking-wider"
                >
                  Step:
                </span>{' '}
                {STEP_LABELS[row.onboardingStep] ?? row.onboardingStep}
              </div>
              <div>
                <span
                  data-mc-label
                  className="text-muted-foreground uppercase tracking-wider"
                >
                  Printers:
                </span>{' '}
                <span data-mc-num className="font-mono">
                  {row.printerCount}
                </span>
              </div>
              <div>
                <span
                  data-mc-label
                  className="text-muted-foreground uppercase tracking-wider"
                >
                  Criada:
                </span>{' '}
                <span data-mc-num>{formatDate(row.createdAt)}</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-3 py-2 text-left font-medium" data-mc-label>
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-3 py-2.5 align-top">{children}</td>;
}
