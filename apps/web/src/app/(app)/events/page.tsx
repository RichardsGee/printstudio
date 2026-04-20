import { desc, eq } from 'drizzle-orm';
import { createDb, events, printers } from '@printstudio/db';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDateTime } from '@/lib/utils';

async function loadEvents() {
  const url = process.env.DATABASE_URL;
  if (!url) return [];
  const db = createDb(url);
  return db
    .select({
      id: events.id,
      type: events.type,
      severity: events.severity,
      message: events.message,
      createdAt: events.createdAt,
      printerName: printers.name,
    })
    .from(events)
    .leftJoin(printers, eq(events.printerId, printers.id))
    .orderBy(desc(events.createdAt))
    .limit(200);
}

const SEVERITY_VARIANT = {
  INFO: 'secondary',
  WARN: 'warning',
  ERROR: 'destructive',
} as const;

export default async function EventsPage() {
  const rows = await loadEvents();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Eventos</h1>
        <p className="text-sm text-muted-foreground">
          Log de eventos do sistema
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{rows.length} eventos</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ul className="divide-y divide-border/60">
            {rows.map((ev) => (
              <li
                key={ev.id}
                className="flex items-start gap-3 p-4"
              >
                <Badge
                  variant={SEVERITY_VARIANT[ev.severity] ?? 'secondary'}
                  className="shrink-0"
                >
                  {ev.severity}
                </Badge>
                <div className="flex-1 min-w-0">
                  <div className="text-sm">{ev.message}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {ev.printerName ?? 'Sistema'} · {ev.type} ·{' '}
                    {formatDateTime(ev.createdAt)}
                  </div>
                </div>
              </li>
            ))}
            {rows.length === 0 && (
              <li className="text-center py-10 text-muted-foreground text-sm">
                Sem eventos.
              </li>
            )}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
