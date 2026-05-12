import { desc, eq } from 'drizzle-orm';
import { createDb, events, printers } from '@printstudio/db';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { SeverityBadge } from '@/components/severity-badge';
import { formatDateTime } from '@/lib/utils';
import { requireCurrentOrgId } from '@/lib/current-org';

async function loadEvents(organizationId: string) {
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
    .where(eq(events.organizationId, organizationId))
    .orderBy(desc(events.createdAt))
    .limit(200);
}

export default async function EventsPage() {
  const orgId = await requireCurrentOrgId();
  const rows = await loadEvents(orgId);

  return (
    <div className="space-y-6">
      <PageHeader
        id="EVENTS"
        title="Eventos"
        description="Log de eventos do sistema"
      />

      <Card data-mc-card>
        <CardHeader>
          <CardTitle className="text-body">
            <span data-mc-num>{rows.length}</span> eventos
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ul className="divide-y divide-border/60">
            {rows.map((ev) => (
              <li
                key={ev.id}
                className="flex items-start gap-3 p-4"
              >
                <SeverityBadge severity={ev.severity} />
                <div className="flex-1 min-w-0">
                  <div className="text-body">{ev.message}</div>
                  <div className="text-caption text-muted-foreground mt-0.5">
                    <span data-mc-id>
                      {ev.printerName ?? 'SISTEMA'} · {ev.type}
                    </span>{' '}
                    · <span data-mc-num>{formatDateTime(ev.createdAt)}</span>
                  </div>
                </div>
              </li>
            ))}
            {rows.length === 0 && (
              <li className="text-center py-10 text-muted-foreground text-small">
                Sem eventos.
              </li>
            )}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
