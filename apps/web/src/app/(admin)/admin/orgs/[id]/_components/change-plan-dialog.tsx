'use client';

import { useState, useTransition, type FormEvent } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { PLAN_KEYS } from '@printstudio/shared';
import { changeOrgPlan } from '../actions';

interface ChangePlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string;
  currentPlan: string;
}

/**
 * Modal de override de plano (Story 9.6). Justificativa obrigatória
 * pra audit/compliance — server action revalida min 10 chars.
 *
 * Plan select exclui o plano atual (UX — não dá pra "mudar pro mesmo").
 */
export function ChangePlanDialog({
  open,
  onOpenChange,
  orgId,
  currentPlan,
}: ChangePlanDialogProps) {
  const [plan, setPlan] = useState(
    PLAN_KEYS.find((p) => p !== currentPlan) ?? PLAN_KEYS[0],
  );
  const [justification, setJustification] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await changeOrgPlan({
        orgId,
        plan,
        justification: justification.trim(),
      });
      if (result.ok) {
        setJustification('');
        setError(null);
        onOpenChange(false);
      } else {
        setError(result.error ?? 'Erro ao mudar plano');
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle className="text-body uppercase tracking-wider">
              Override de plano
            </DialogTitle>
            <DialogDescription>
              Plano atual:{' '}
              <span className="font-mono uppercase tracking-wider text-foreground">
                {currentPlan}
              </span>
              . Mudança ignora billing — use só com justificativa
              documentada.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label
              htmlFor="plan"
              data-mc-label
              className="text-caption uppercase tracking-wider"
            >
              Novo plano
            </Label>
            <Select
              id="plan"
              value={plan}
              onChange={(e) => setPlan(e.target.value as typeof plan)}
              required
            >
              {PLAN_KEYS.filter((p) => p !== currentPlan).map((p) => (
                <option key={p} value={p}>
                  {p.toUpperCase()}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="justification"
              data-mc-label
              className="text-caption uppercase tracking-wider"
            >
              Justificativa (min 10 chars)
            </Label>
            <textarea
              id="justification"
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              minLength={10}
              maxLength={500}
              rows={3}
              required
              placeholder="Ex: cortesia ao usuário X após problema Y..."
              className="w-full resize-y rounded-md border border-input bg-transparent px-3 py-2 text-small shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            <div className="flex justify-between text-caption text-muted-foreground">
              <span>{justification.length}/500</span>
            </div>
          </div>

          {error && (
            <div
              role="alert"
              className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-small text-destructive"
            >
              {error}
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={pending || justification.trim().length < 10}
            >
              {pending ? 'Aplicando…' : 'Aplicar override'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
