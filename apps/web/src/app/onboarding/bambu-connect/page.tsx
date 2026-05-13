import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { WizardProgress } from '../_components/wizard-progress';

export const metadata: Metadata = {
  title: 'Onboarding · Bambu Connect · PrintStudio',
  robots: { index: false, follow: false },
};

/**
 * Step 2 placeholder — Story 8.4 vai implementar conexão Bambu Cloud real.
 *
 * Layout pai já valida session e step. Esta página existe pra destrava
 * o redirect da Story 8.3 (server action `updateOrgProfile` redireciona
 * pra cá após avançar `onboarding_step` → 'bambu_connect').
 */
export default function OnboardingBambuConnectPage() {
  return (
    <div className="container max-w-2xl space-y-6">
      <WizardProgress current="bambu_connect" />

      <Card data-mc-card>
        <CardHeader className="space-y-2">
          <div
            data-mc-id
            className="text-caption font-mono uppercase tracking-widest text-primary"
          >
            {'// STEP-02/03 · BAMBU-CONNECT'}
          </div>
          <CardTitle className="text-2xl">Conectar Bambu Lab Cloud</CardTitle>
          <CardDescription>
            Story 8.4 vai implementar a conexão real. Por enquanto você
            pode pular pro dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-small text-muted-foreground">
            Em breve você vai poder colar suas credenciais Bambu Cloud
            aqui pra começar a monitorar suas A1 remotamente. Por enquanto,
            o passo seguinte do onboarding ainda não está pronto.
          </p>
          <div className="flex gap-3">
            <Button asChild variant="outline">
              <Link href="/onboarding/profile">Voltar</Link>
            </Button>
            <Button asChild>
              <Link href="/dashboard">Ir pro dashboard</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
