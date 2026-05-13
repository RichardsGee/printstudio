'use client';

import { useState, useTransition, type FormEvent } from 'react';
import { Plus, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import type { WaitlistRow } from '@/lib/waitlist-queries';
import {
  addWaitlistTag,
  removeWaitlistTag,
  updateWaitlistNotes,
} from '../actions';
import { cn } from '@/lib/utils';

interface WaitlistDetailDrawerProps {
  row: WaitlistRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Drawer com detalhes completos do lead + edição inline de notes e
 * tags (Story 9.3 AC #5).
 *
 * Tags: lowercase, alfanumérico + `_-`, validação client antes de
 * disparar action. Notes: textarea com Save explícito.
 */
export function WaitlistDetailDrawer({
  row,
  open,
  onOpenChange,
}: WaitlistDetailDrawerProps) {
  const [notes, setNotes] = useState(row.notes ?? '');
  const [tagInput, setTagInput] = useState('');
  const [tagError, setTagError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function saveNotes() {
    startTransition(async () => {
      await updateWaitlistNotes({ id: row.id, notes });
    });
  }

  function handleAddTag(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const tag = tagInput.trim().toLowerCase();
    if (!tag) return;
    if (!/^[a-z0-9_-]+$/.test(tag)) {
      setTagError('Use letras, números, _ ou -');
      return;
    }
    setTagError(null);
    startTransition(async () => {
      const result = await addWaitlistTag({ id: row.id, tag });
      if (result.ok) setTagInput('');
      else setTagError(result.error ?? 'Erro');
    });
  }

  function handleRemoveTag(tag: string) {
    startTransition(async () => {
      await removeWaitlistTag({ id: row.id, tag });
    });
  }

  const notesChanged = (row.notes ?? '') !== notes;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="space-y-1">
          <DialogTitle className="text-body uppercase tracking-wider">
            {row.name}
          </DialogTitle>
          <DialogDescription className="font-mono text-caption">
            {row.email}
          </DialogDescription>
        </div>

        <div
          data-mc-card
          className="space-y-2 rounded-md border border-[var(--mc-accent-soft)]/30 p-3 text-small"
        >
          <DetailRow label="STATUS" value={row.status} />
          <DetailRow
            label="USO"
            value={`${row.role} · ${row.bambuCount} bambu`}
          />
          <DetailRow
            label="REGIÃO"
            value={
              row.state
                ? `${row.state}${row.city ? ` · ${row.city}` : ''}`
                : '—'
            }
          />
          <DetailRow label="WHATSAPP" value={row.phone ?? '—'} />
          <DetailRow label="TELEGRAM" value={row.telegramHandle ?? '—'} />
          <DetailRow
            label="CONTATADO"
            value={formatDateTime(row.lastContactAt)}
          />
          <DetailRow label="CRIADO" value={formatDateTime(row.createdAt)} />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label data-mc-label className="text-caption uppercase tracking-wider">
              Tags
            </Label>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {row.tags.length === 0 ? (
              <span className="text-caption text-muted-foreground">
                Nenhuma tag
              </span>
            ) : (
              row.tags.map((tag) => (
                <Badge
                  key={tag}
                  variant="outline"
                  className="gap-1 pr-1 text-caption"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    disabled={pending}
                    aria-label={`Remover tag ${tag}`}
                    className="inline-flex size-4 items-center justify-center rounded hover:bg-destructive/10 hover:text-destructive"
                  >
                    <X className="size-3" aria-hidden="true" />
                  </button>
                </Badge>
              ))
            )}
          </div>
          <form onSubmit={handleAddTag} className="flex gap-2">
            <Input
              type="text"
              placeholder="Adicionar tag (ex: hot-lead)"
              value={tagInput}
              onChange={(e) => {
                setTagInput(e.target.value);
                setTagError(null);
              }}
              maxLength={50}
              className="h-8 text-caption"
            />
            <Button
              type="submit"
              size="sm"
              variant="outline"
              disabled={pending || !tagInput.trim()}
              className={cn('gap-1', !tagInput.trim() && 'opacity-50')}
            >
              <Plus className="size-3" aria-hidden="true" />
              Add
            </Button>
          </form>
          {tagError && (
            <p className="text-caption text-destructive" role="alert">
              {tagError}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label
            htmlFor="lead-notes"
            data-mc-label
            className="text-caption uppercase tracking-wider"
          >
            Notes internas
          </Label>
          <textarea
            id="lead-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={2000}
            rows={4}
            placeholder="Contexto, próximo passo, motivos…"
            className="w-full resize-y rounded-md border border-input bg-transparent px-3 py-2 text-small shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
          <div className="flex items-center justify-between">
            <span className="text-caption text-muted-foreground">
              {notes.length}/2000
            </span>
            <Button
              type="button"
              size="sm"
              onClick={saveNotes}
              disabled={pending || !notesChanged}
            >
              {pending ? 'Salvando…' : notesChanged ? 'Salvar notes' : 'Sem mudanças'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <span
        data-mc-label
        className="w-20 shrink-0 text-caption font-mono uppercase tracking-wider text-muted-foreground"
      >
        {label}
      </span>
      <span className="text-small font-mono">{value}</span>
    </div>
  );
}

function formatDateTime(d: Date | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
