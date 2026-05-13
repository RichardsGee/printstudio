'use client';

import Link from 'next/link';
import { useMemo, useState, useTransition } from 'react';
import { AlertCircle } from 'lucide-react';
import type { BambuDevice } from '@printstudio/shared';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { WizardProgress } from '../_components/wizard-progress';
import {
  addPrintersFromBambu,
  skipAddPrinters,
  type PrinterSelectionInput,
} from './actions';
import { cn } from '@/lib/utils';

interface AddPrintersClientProps {
  devices: BambuDevice[];
  loadFailed: boolean;
  plan: string;
}

/**
 * UI do step 3 do wizard.
 *
 * Free tier (plan='free'): radio button — só 1 device selecionável.
 * Paid tier: checkbox (preparado pra Story 8.6 / Pro plan).
 *
 * Cada device tem nome editável inline (default = nome Bambu).
 */
export function AddPrintersClient({ devices, loadFailed, plan }: AddPrintersClientProps) {
  const isFree = plan === 'free';
  const [selectedSerials, setSelectedSerials] = useState<Set<string>>(
    () => new Set(devices[0] ? [devices[0].serial] : []),
  );
  const [customNames, setCustomNames] = useState<Record<string, string>>({});
  const [skipOpen, setSkipOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const isEmpty = !loadFailed && devices.length === 0;

  function toggleSelection(serial: string, checked: boolean) {
    setSelectedSerials((prev) => {
      const next = new Set(prev);
      if (isFree) {
        // Free tier: comporta como radio — só 1 ativo por vez
        next.clear();
        if (checked) next.add(serial);
        return next;
      }
      if (checked) next.add(serial);
      else next.delete(serial);
      return next;
    });
  }

  function updateCustomName(serial: string, name: string) {
    setCustomNames((prev) => ({ ...prev, [serial]: name }));
  }

  const selections: PrinterSelectionInput[] = useMemo(() => {
    return devices
      .filter((d) => selectedSerials.has(d.serial))
      .map((d) => ({
        serial: d.serial,
        name: (customNames[d.serial] ?? d.name).trim() || d.name,
        model: d.model,
      }));
  }, [devices, selectedSerials, customNames]);

  function handleSubmit() {
    if (selections.length === 0) {
      setServerError('Selecione pelo menos 1 impressora');
      return;
    }
    setServerError(null);
    startTransition(async () => {
      const result = await addPrintersFromBambu(selections);
      if (result && !result.ok && result.error) {
        setServerError(result.error.message);
      }
      // Sucesso → action faz redirect /kiosk
    });
  }

  function handleSkipConfirm() {
    startTransition(async () => {
      const result = await skipAddPrinters();
      if (result && !result.ok && result.error) {
        setServerError(result.error.message);
        setSkipOpen(false);
      }
    });
  }

  return (
    <div className="container max-w-2xl space-y-6">
      <WizardProgress current="printers" />

      <div className="space-y-2">
        <div
          data-mc-id
          className="text-caption font-mono uppercase tracking-widest text-primary"
        >
          {'// STEP-03/03 · PRINTERS'}
        </div>
        <h1 className="text-2xl font-semibold">Quais impressoras monitorar?</h1>
        <p className="text-small text-muted-foreground">
          {isFree
            ? 'Plano Free permite 1 impressora. Você pode adicionar mais ao fazer upgrade.'
            : 'Escolha quais impressoras adicionar ao painel.'}
        </p>
      </div>

      {loadFailed && (
        <Card data-mc-card>
          <CardHeader className="space-y-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="size-5 text-destructive" aria-hidden="true" />
              <CardTitle>Não foi possível listar suas impressoras</CardTitle>
            </div>
            <CardDescription>
              Pode ser que a Bambu Cloud esteja instável ou seu token tenha
              expirado. Você pode tentar reconectar ou pular este passo.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-3">
            <Button asChild variant="outline">
              <Link href="/onboarding/bambu-connect">Reconectar Bambu</Link>
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setSkipOpen(true)}
              disabled={pending}
            >
              Pular por enquanto
            </Button>
          </CardContent>
        </Card>
      )}

      {isEmpty && (
        <Card data-mc-card>
          <CardHeader className="space-y-2">
            <CardTitle>Nenhuma impressora encontrada</CardTitle>
            <CardDescription>
              Sua conta Bambu Cloud está vinculada, mas não há impressoras
              registradas nela ainda. Vincule pelo menos uma A1 na app
              oficial Bambu Lab e volte aqui.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-3">
            <Button asChild variant="outline">
              <Link href="/onboarding/bambu-connect">Voltar pra Bambu Connect</Link>
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setSkipOpen(true)}
              disabled={pending}
            >
              Pular por enquanto
            </Button>
          </CardContent>
        </Card>
      )}

      {!loadFailed && !isEmpty && (
        <Card data-mc-card>
          <CardHeader>
            <CardTitle className="text-body uppercase tracking-wider">
              {`${devices.length} impressora${devices.length === 1 ? '' : 's'} detectada${devices.length === 1 ? '' : 's'}`}
            </CardTitle>
            <CardDescription>
              Você pode customizar o nome de exibição agora — sempre dá pra
              trocar depois em Configurações.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <ul className="space-y-3">
              {devices.map((device) => {
                const selected = selectedSerials.has(device.serial);
                const customName = customNames[device.serial] ?? device.name;
                return (
                  <li
                    key={device.serial}
                    className={cn(
                      'rounded-md border p-4 transition-colors',
                      selected
                        ? 'border-primary bg-primary/5'
                        : 'border-input',
                    )}
                  >
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type={isFree ? 'radio' : 'checkbox'}
                        name={isFree ? 'printer-selection' : `printer-${device.serial}`}
                        value={device.serial}
                        checked={selected}
                        onChange={(e) =>
                          toggleSelection(device.serial, e.target.checked)
                        }
                        className="mt-1 size-4 cursor-pointer accent-primary"
                      />
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-caption font-mono uppercase tracking-wider text-muted-foreground">
                            {device.model} · {device.serial}
                          </span>
                          <Badge variant={device.online ? 'default' : 'secondary'}>
                            {device.online ? 'online' : 'offline'}
                          </Badge>
                        </div>
                        {selected ? (
                          <div className="space-y-1">
                            <Label
                              htmlFor={`name-${device.serial}`}
                              className="text-caption uppercase tracking-wider"
                            >
                              Nome de exibição
                            </Label>
                            <Input
                              id={`name-${device.serial}`}
                              type="text"
                              value={customName}
                              onChange={(e) =>
                                updateCustomName(device.serial, e.target.value)
                              }
                              maxLength={100}
                              onClick={(e) => e.stopPropagation()}
                              onMouseDown={(e) => e.stopPropagation()}
                            />
                          </div>
                        ) : (
                          <div className="text-body font-medium">{device.name}</div>
                        )}
                      </div>
                    </label>
                  </li>
                );
              })}
            </ul>

            {serverError && (
              <div
                role="alert"
                className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-small text-destructive"
              >
                {serverError}
              </div>
            )}

            <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={() => setSkipOpen(true)}
                disabled={pending}
              >
                Pular — adicionar depois
              </Button>
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={pending || selections.length === 0}
              >
                {pending
                  ? 'Adicionando…'
                  : `Adicionar ${selections.length > 1 ? `${selections.length} impressoras` : 'impressora'}`}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={skipOpen} onOpenChange={setSkipOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pular adição de impressoras?</DialogTitle>
            <DialogDescription>
              Sem impressoras cadastradas, o painel vai aparecer vazio. Você
              pode adicionar depois em Configurações &gt; Impressoras.
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
