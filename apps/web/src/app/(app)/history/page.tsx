import { desc, eq } from 'drizzle-orm';
import { createDb, printJobs, printers } from '@printstudio/db';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDateTime, formatDuration } from '@/lib/utils';

async function loadJobs() {
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
    .orderBy(desc(printJobs.startedAt))
    .limit(100);
}

const STATUS_VARIANT = {
  RUNNING: 'warning',
  SUCCESS: 'success',
  FAILED: 'destructive',
  CANCELLED: 'outline',
} as const;

export default async function HistoryPage() {
  const jobs = await loadJobs();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Histórico</h1>
        <p className="text-sm text-muted-foreground">Impressões registradas</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{jobs.length} impressões</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="text-left py-2 px-4">Arquivo</th>
                  <th className="text-left py-2 px-4">Impressora</th>
                  <th className="text-left py-2 px-4">Início</th>
                  <th className="text-left py-2 px-4">Duração</th>
                  <th className="text-left py-2 px-4">Status</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((j) => (
                  <tr key={j.id} className="border-t border-border/60">
                    <td className="py-2 px-4 max-w-[320px] truncate">
                      {j.fileName}
                    </td>
                    <td className="py-2 px-4">{j.printerName ?? '—'}</td>
                    <td className="py-2 px-4 text-muted-foreground">
                      {formatDateTime(j.startedAt)}
                    </td>
                    <td className="py-2 px-4 font-mono">
                      {formatDuration(j.durationSec)}
                    </td>
                    <td className="py-2 px-4">
                      <Badge
                        variant={STATUS_VARIANT[j.status] ?? 'secondary'}
                      >
                        {j.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
                {jobs.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="text-center py-10 text-muted-foreground text-sm"
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
