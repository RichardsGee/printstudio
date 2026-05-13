import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';

/**
 * Placeholder do wizard de onboarding (Story 8.3 vai implementar de fato).
 *
 * Exists pra que o redirect pós-signup (Story 8.1) caia numa rota válida
 * em vez de 404. O conteúdo real vem em Story 8.3.
 */
export default function OnboardingProfilePage() {
  return (
    <div className="container max-w-2xl py-12 space-y-8">
      <PageHeader
        id="ONBOARDING"
        title="STEP-01 · PROFILE"
        description="Bem-vindo ao PrintStudio. O wizard completo de onboarding chega na Story 8.3."
        showTimestamp={false}
      />

      <Card data-mc-card>
        <CardHeader className="space-y-3">
          <p
            data-mc-id
            className="text-caption font-mono uppercase tracking-wider text-primary"
          >
            {'// STATUS · ACCOUNT-CREATED'}
          </p>
          <h2 className="text-2xl font-semibold">Sua conta foi criada</h2>
        </CardHeader>
        <CardContent className="space-y-4 text-small text-muted-foreground">
          <p>
            Conta criada com sucesso. Em breve você vai poder:
          </p>
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li>Conectar suas credenciais Bambu Lab Cloud</li>
            <li>Adicionar suas impressoras A1</li>
            <li>Personalizar o painel Mission Control</li>
          </ul>
          <p className="pt-2 text-caption">
            Por enquanto você pode ir direto pro dashboard.
          </p>
          <div className="pt-2">
            <Button asChild>
              <Link href="/dashboard">Ir pro dashboard</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
