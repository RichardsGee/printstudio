import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { WizardProgress } from '../_components/wizard-progress';

export const metadata: Metadata = {
  title: 'Onboarding · Impressoras · PrintStudio',
  robots: { index: false, follow: false },
};

/**
 * Step 3 placeholder — Story 8.5 vai implementar a adição de
 * impressoras pra finalizar onboarding (`onboarding_step` →
 * `completed` + `onboarding_completed_at`).
 *
 * Layout pai já validou session e step. Esta página existe pra
 * destrava o redirect da Story 8.4.
 */
export default function OnboardingPrintersPage() {
  return (
    <div className="container max-w-2xl space-y-6">
      <WizardProgress current="printers" />

      <Card data-mc-card>
        <CardHeader className="space-y-2">
          <div
            data-mc-id
            className="text-caption font-mono uppercase tracking-widest text-primary"
          >
            {'// STEP-03/03 · PRINTERS'}
          </div>
          <CardTitle className="text-2xl">Adicionar impressoras</CardTitle>
          <CardDescription>
            Story 8.5 vai implementar a sincronização das impressoras Bambu.
            Por enquanto você pode ir direto pro dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-small text-muted-foreground">
            Em breve as impressoras detectadas na sua conta Bambu Cloud
            vão aparecer aqui pra você escolher quais monitorar e
            personalizar nomes/displayOrder.
          </p>
          <div className="flex gap-3">
            <Button asChild variant="outline">
              <Link href="/onboarding/bambu-connect">Voltar</Link>
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
