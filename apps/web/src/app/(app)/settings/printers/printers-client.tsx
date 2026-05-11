'use client';

import { useState, useTransition } from 'react';
import { Check, X, Pencil, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { renamePrinterAction, deletePrinterAction } from './actions';

interface PrinterRow {
  id: string;
  name: string;
  serial: string;
  model: string;
  createdAt: string;
}

interface Props {
  printers: PrinterRow[];
}

export function PrintersAdminClient({ printers }: Props) {
  return (
    <Card data-mc-card>
      <CardHeader>
        <CardTitle className="text-body uppercase tracking-wider">
          <span data-mc-num>{printers.length}</span> impressora
          {printers.length === 1 ? '' : 's'}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {printers.length === 0 ? (
          <div className="p-8 text-center text-small text-muted-foreground">
            Nenhuma impressora cadastrada.
          </div>
        ) : (
          <ul className="divide-y divide-[var(--mc-accent-soft)]/30">
            {printers.map((p) => (
              <PrinterRowItem key={p.id} printer={p} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function PrinterRowItem({ printer }: { printer: PrinterRow }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(printer.name);
  const [pending, start] = useTransition();

  function startEdit() {
    setDraft(printer.name);
    setEditing(true);
  }

  function cancel() {
    setDraft(printer.name);
    setEditing(false);
  }

  function save() {
    const trimmed = draft.trim();
    if (trimmed === printer.name) {
      setEditing(false);
      return;
    }
    start(async () => {
      const result = await renamePrinterAction(printer.id, trimmed);
      if (result.ok) {
        toast.success(`Renomeado pra "${trimmed}"`);
        setEditing(false);
      } else {
        toast.error(result.error);
      }
    });
  }

  function remove() {
    if (
      !confirm(
        `Remover a impressora "${printer.name}"?\nEssa ação NÃO pode ser desfeita.`,
      )
    ) {
      return;
    }
    start(async () => {
      const result = await deletePrinterAction(printer.id);
      if (result.ok) {
        toast.success('Impressora removida');
      } else {
        toast.error(result.error);
      }
    });
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') save();
    if (e.key === 'Escape') cancel();
  }

  return (
    <li className="flex items-center gap-3 p-4">
      <div className="flex-1 min-w-0 space-y-1">
        {editing ? (
          <Input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            disabled={pending}
            maxLength={100}
            className="text-body font-semibold tracking-wider"
          />
        ) : (
          <div className="text-body font-semibold truncate uppercase tracking-wider">
            {printer.name}
          </div>
        )}
        <div
          data-mc-id
          className="text-caption text-muted-foreground uppercase tracking-wider"
        >
          {`// ${printer.model} · SN ${printer.serial}`}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {editing ? (
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={save}
              disabled={pending}
              className="uppercase tracking-wider"
            >
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              <span className="sr-only">Salvar</span>
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={cancel}
              disabled={pending}
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Cancelar</span>
            </Button>
          </>
        ) : (
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={startEdit}
              disabled={pending}
              className="uppercase tracking-wider"
            >
              <Pencil className="h-4 w-4 mr-1.5" />
              Renomear
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={remove}
              disabled={pending}
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              <span className="sr-only">Remover</span>
            </Button>
          </>
        )}
      </div>
    </li>
  );
}
