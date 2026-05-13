'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { BambuConnectFlow } from '@/components/bambu/bambu-connect-flow';
import { WizardProgress } from '../_components/wizard-progress';
import { advanceOnboardingStep, skipBambuConnect } from '../_actions';

/**
 * Wrapper client do step 2 do wizard (Story 8.4).
 *
 * Combina:
 * - WizardProgress (current=bambu_connect)
 * - BambuConnectFlow com onSuccess → advanceOnboardingStep
 * - Skip button com Dialog de confirmação → skipBambuConnect
 *
 * Não faz fetch direto da Bambu — delega tudo pro BambuConnectFlow
 * (reutilizado de /settings/bambu-connect).
 */
export function BambuOnboardingClient() {
  const [skipOpen, setSkipOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleSuccess() {
    startTransition(async () => {
      // Em sucesso, action faz redirect() — esta promise não resolve
      // em fluxo normal. Resultado só é capturado em erro (WRONG_STEP
      // ou INTERNAL_ERROR), nesses casos UI continua na página.
      await advanceOnboardingStep();
    });
  }

  function handleSkipConfirm() {
    startTransition(async () => {
      await skipBambuConnect();
    });
  }

  return (
    <div className="container max-w-xl space-y-6">
      <WizardProgress current="bambu_connect" />

      <div className="space-y-2">
        <div
          data-mc-id
          className="text-caption font-mono uppercase tracking-widest text-primary"
        >
          {'// STEP-02/03 · BAMBU-CONNECT'}
        </div>
        <h1 className="text-2xl font-semibold">Conecte sua Bambu Cloud</h1>
        <p className="text-small text-muted-foreground">
          Vamos buscar suas impressoras automaticamente da sua conta Bambu
          Cloud. Geralmente leva menos de 30 segundos.
        </p>
      </div>

      <BambuConnectFlow
        onSuccess={handleSuccess}
        successCta={
          <Button onClick={handleSuccess} disabled={pending} className="w-full">
            {pending ? 'Avançando…' : 'Próximo →'}
          </Button>
        }
      />

      <div className="flex justify-center pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => setSkipOpen(true)}
          disabled={pending}
        >
          Pular por enquanto
        </Button>
      </div>

      <Dialog open={skipOpen} onOpenChange={setSkipOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pular conexão Bambu?</DialogTitle>
            <DialogDescription>
              Sem vincular sua conta Bambu Cloud, o painel não vai mostrar
              telemetria das impressoras. Você pode vincular depois em
              Configurações &gt; Bambu Connect.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setSkipOpen(false)}
              disabled={pending}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleSkipConfirm}
              disabled={pending}
            >
              {pending ? 'Pulando…' : 'Pular mesmo assim'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
