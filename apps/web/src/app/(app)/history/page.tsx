import { desc, eq } from 'drizzle-orm';
import { createDb, printJobs, printers } from '@printstudio/db';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { JobStatusBadge } from '@/components/job-status-badge';
import { formatDateTime, formatDuration } from '@/lib/utils';
import { requireCurrentOrgId } from '@/lib/current-org';

async function loadJobs(organizationId: string) {
  const url = process.env.DATABASE_URL;
  if (!url) return [];
  const db = createDb(url);
  return db
    .select({
      id: printJobs.id,
      fileName: printJobs.fileName,
      startedAt: printJobs.startedAt,
      finishedAt: printJobs.finishedAt,
      status: printJobs.status,
      durationSec: printJobs.durationSec,
      printerName: printers.name,
    })
    .from(printJobs)
    .leftJoin(printers, eq(printJobs.printerId, printers.id))
    .where(eq(printJobs.organizationId, organizationId))
    .orderBy(desc(printJobs.startedAt))
    .limit(100);
}

export default async function HistoryPage() {
  const orgId = await requireCurrentOrgId();
  const jobs = await loadJobs(orgId);

  return (
    <div className="space-y-6">
      <PageHeader
        id="PRINT-LOG"
        title="Histórico"
        description="Impressões registradas"
      />

      <Card data-mc-card>
        <CardHeader>
          <CardTitle className="text-body">
            <span data-mc-num>{jobs.length}</span> impressões
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-body">
              <thead className="bg-muted/30 text-caption uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left py-2 px-4" data-mc-label>Arquivo</th>
                  <th className="text-left py-2 px-4" data-mc-label>Impressora</th>
                  <th className="text-left py-2 px-4" data-mc-label>Início</th>
                  <th className="text-left py-2 px-4" data-mc-label>Duração</th>
                  <th className="text-left py-2 px-4" data-mc-label>Status</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((j) => (
                  <tr key={j.id} className="border-t border-border/60">
                    <td className="py-2 px-4 max-w-[320px] truncate">
                      {j.fileName}
                    </td>
                    <td className="py-2 px-4">{j.printerName ?? '—'}</td>
                    <td className="py-2 px-4 text-muted-foreground" data-mc-num>
                      {formatDateTime(j.startedAt)}
                    </td>
                    <td className="py-2 px-4" data-mc-num>
                      {formatDuration(j.durationSec)}
                    </td>
                    <td className="py-2 px-4">
                      <JobStatusBadge status={j.status} />
                    </td>
                  </tr>
                ))}
                {jobs.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="text-center py-10 text-muted-foreground text-small"
                    >
                      Nenhuma impressão registrada.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
