import type { Metadata } from 'next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';

export const metadata: Metadata = {
  title: 'Admin · PrintStudio',
  description: 'Painel administrativo super-admin.',
  robots: { index: false, follow: false },
};

/**
 * Página raiz do Admin Panel — `/admin` (Story 9.1).
 *
 * Layout pai (`requireSuperAdmin`) já validou flag. Por enquanto é
 * placeholder com links pras seções que virão nas Stories 9.2 → 9.10.
 */
export default function AdminHomePage() {
  return (
    <div className="container max-w-5xl space-y-8">
      <PageHeader
        id="ADMIN-HOME"
        title="Mission Control · Admin"
        description="Painel interno pra gestão da plataforma."
        showTimestamp={false}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <SectionCard
          code="9.3"
          title="Waitlist"
          description="Gerenciar leads, filtrar, etiquetar e qualificar."
          status="em-breve"
        />
        <SectionCard
          code="9.4"
          title="Convites"
          description="Gerar invite tokens pra waitlist virar user."
          status="em-breve"
        />
        <SectionCard
          code="9.5"
          title="Users · Orgs"
          description="Listar contas cadastradas, filtros e busca."
          status="em-breve"
        />
        <SectionCard
          code="9.7"
          title="Assinaturas"
          description="Subscriptions Asaas, status, MRR."
          status="em-breve"
        />
        <SectionCard
          code="9.8"
          title="Métricas"
          description="Funil de onboarding e drop-off por step."
          status="em-breve"
        />
        <SectionCard
          code="9.9"
          title="Audit log"
          description="Ações sensíveis dos admins."
          status="em-breve"
        />
      </div>
    </div>
  );
}

function SectionCard({
  code,
  title,
  description,
  status,
}: {
  code: string;
  title: string;
  description: string;
  status: 'em-breve' | 'pronto';
}) {
  return (
    <Card data-mc-card className="h-full">
      <CardHeader className="space-y-2">
        <div className="flex items-center justify-between">
          <span
            data-mc-id
            className="text-caption font-mono uppercase tracking-wider text-primary"
          >
            {`// STORY · ${code}`}
          </span>
          <span
            className={`text-caption font-mono uppercase tracking-wider ${
              status === 'pronto' ? 'text-primary' : 'text-muted-foreground'
            }`}
          >
            {status === 'pronto' ? 'PRONTO' : 'EM-BREVE'}
          </span>
        </div>
        <CardTitle className="text-body-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent className="text-small text-muted-foreground">
        {description}
      </CardContent>
    </Card>
  );
}
