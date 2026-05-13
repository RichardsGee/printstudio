import type { Metadata } from 'next';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';

export const metadata: Metadata = {
  title: 'Admin · Waitlist · PrintStudio',
  robots: { index: false, follow: false },
};

/**
 * Placeholder de `/admin/waitlist` — Story 9.3 vai implementar a
 * gestão real (listar leads, filtrar por status/role/região, tag,
 * notes, etc).
 *
 * Existe agora pra destrava o redirect `/admin` → `/admin/waitlist`
 * (Story 9.2 AC #5). Layout pai já validou super_admin.
 */
export default function AdminWaitlistPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        id="ADMIN-WAITLIST"
        title="Waitlist"
        description="Leads cadastrados na fila do guiaprint3d.com — implementação real virá na Story 9.3."
        showTimestamp={false}
      />

      <Card data-mc-card>
        <CardHeader>
          <p
            data-mc-id
            className="text-caption font-mono uppercase tracking-wider text-primary"
          >
            {'// STORY 9.3 · PENDING'}
          </p>
        </CardHeader>
        <CardContent className="space-y-3 text-small text-muted-foreground">
          <p>
            Story 9.3 vai trazer aqui:
          </p>
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li>Tabela completa de leads com paginação</li>
            <li>Filtros por status / role / região / data</li>
            <li>Tag + notes por lead</li>
            <li>Marcar status (contacted, engaged, lost)</li>
            <li>CTA &quot;Gerar convite&quot; (link com Story 9.4)</li>
            <li>Export CSV (Story 9.10)</li>
          </ul>
          <p className="pt-2">
            Por enquanto leads podem ser inspecionados via SQL direto na
            tabela <code className="font-mono text-primary">waitlist</code>.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
