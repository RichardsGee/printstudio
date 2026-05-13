'use client';

import { useState, useTransition } from 'react';
import { MessageCircle, Send, MoreVertical, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import type { WaitlistRow } from '@/lib/waitlist-queries';
import {
  updateWaitlistStatus,
  markWaitlistContacted,
} from '../actions';
import { cn } from '@/lib/utils';
import { WaitlistDetailDrawer } from './waitlist-detail-drawer';

const STATUS_OPTIONS = [
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contactado' },
  { value: 'engaged', label: 'Engaged' },
  { value: 'invited', label: 'Invited' },
  { value: 'converted', label: 'Convertido' },
  { value: 'lost', label: 'Lost' },
] as const;

const STATUS_BADGE_CLASSES: Record<string, string> = {
  new: 'border-blue-500/40 bg-blue-500/10 text-blue-300',
  contacted: 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300',
  engaged: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  invited: 'border-violet-500/40 bg-violet-500/10 text-violet-300',
  converted: 'border-primary/40 bg-primary/10 text-primary',
  lost: 'border-zinc-500/40 bg-zinc-500/10 text-zinc-400',
};

const ROLE_LABELS: Record<string, string> = {
  hobbyist: 'Hobby',
  small_shop: 'Print shop',
  studio: 'Estúdio',
  business: 'Empresa',
  other: 'Outro',
};

interface WaitlistTableProps {
  rows: WaitlistRow[];
}

/**
 * Tabela waitlist (Story 9.3).
 *
 * Mobile (< lg): vira cards stack. Desktop: tabela tradicional com
 * scroll horizontal se necessário.
 *
 * Inline edits:
 * - Status: <Select> que dispara `updateWaitlistStatus` server action
 * - Marcar contatado: botão que dispara `markWaitlistContacted`
 * - Notes/tags: drawer detail abre painel completo
 *
 * Optimistic UI: status update muda imediatamente; rollback se action
 * falhar (revalidatePath garante consistência).
 */
export function WaitlistTable({ rows }: WaitlistTableProps) {
  const [detailRow, setDetailRow] = useState<WaitlistRow | null>(null);

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-[var(--mc-accent-soft)]/30 bg-card/40 p-8 text-center">
        <p
          data-mc-id
          className="text-caption font-mono uppercase tracking-wider text-muted-foreground"
        >
          {'// NO LEADS · NO FILTERS MATCH'}
        </p>
        <p className="mt-2 text-small text-muted-foreground">
          Nenhum lead encontrado com os filtros aplicados.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="hidden overflow-hidden rounded-lg border border-[var(--mc-accent-soft)]/30 lg:block">
        <table className="w-full text-small">
          <thead className="bg-card/40 text-caption uppercase tracking-wider text-muted-foreground">
            <tr>
              <Th>Lead</Th>
              <Th>Região</Th>
              <Th>Uso</Th>
              <Th>Bambu</Th>
              <Th>Status</Th>
              <Th>Tags</Th>
              <Th>Criado</Th>
              <Th>Ações</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <WaitlistRowDesktop
                key={row.id}
                row={row}
                onOpenDetail={() => setDetailRow(row)}
              />
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 lg:hidden">
        {rows.map((row) => (
          <WaitlistRowMobile
            key={row.id}
            row={row}
            onOpenDetail={() => setDetailRow(row)}
          />
        ))}
      </div>

      {detailRow && (
        <WaitlistDetailDrawer
          row={detailRow}
          open={!!detailRow}
          onOpenChange={(open) => !open && setDetailRow(null)}
        />
      )}
    </>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-3 py-2 text-left font-medium" data-mc-label>
      {children}
    </th>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'font-mono uppercase tracking-wider',
        STATUS_BADGE_CLASSES[status],
      )}
    >
      {status}
    </Badge>
  );
}

function formatDate(d: Date | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  });
}

interface RowProps {
  row: WaitlistRow;
  onOpenDetail: () => void;
}

function WaitlistRowDesktop({ row, onOpenDetail }: RowProps) {
  const [pending, startTransition] = useTransition();

  function handleStatusChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value;
    startTransition(async () => {
      await updateWaitlistStatus({
        id: row.id,
        status: next as (typeof STATUS_OPTIONS)[number]['value'],
      });
    });
  }

  function handleMarkContacted() {
    startTransition(async () => {
      await markWaitlistContacted({ id: row.id });
    });
  }

  return (
    <tr className="border-t border-[var(--mc-accent-soft)]/20 hover:bg-card/30">
      <td className="px-3 py-2.5">
        <div className="space-y-0.5">
          <div className="font-medium">{row.name}</div>
          <div className="text-caption text-muted-foreground font-mono">
            {row.email}
          </div>
        </div>
      </td>
      <td className="px-3 py-2.5 text-caption">
        {row.state ?? '—'}
        {row.city ? ` · ${row.city}` : ''}
      </td>
      <td className="px-3 py-2.5">
        <span className="text-caption">{ROLE_LABELS[row.role] ?? row.role}</span>
      </td>
      <td className="px-3 py-2.5">
        <span data-mc-num className="font-mono">
          {row.bambuCount}
        </span>
      </td>
      <td className="px-3 py-2.5">
        <Select
          value={row.status}
          onChange={handleStatusChange}
          disabled={pending}
          className="h-8 text-caption"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </Select>
      </td>
      <td className="px-3 py-2.5">
        <div className="flex flex-wrap gap-1">
          {row.tags.length === 0 ? (
            <span className="text-caption text-muted-foreground">—</span>
          ) : (
            row.tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="outline" className="text-caption">
                {tag}
              </Badge>
            ))
          )}
          {row.tags.length > 3 && (
            <span className="text-caption text-muted-foreground">
              +{row.tags.length - 3}
            </span>
          )}
        </div>
      </td>
      <td className="px-3 py-2.5 text-caption text-muted-foreground">
        <span data-mc-num>{formatDate(row.createdAt)}</span>
      </td>
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-1">
          <ContactButtons row={row} />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleMarkContacted}
            disabled={pending}
            title="Marcar como contatado"
            className="size-7"
          >
            <Send className="size-3.5" aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onOpenDetail}
            title="Abrir detalhes"
            className="size-7"
          >
            <MoreVertical className="size-3.5" aria-hidden="true" />
          </Button>
        </div>
      </td>
    </tr>
  );
}

function WaitlistRowMobile({ row, onOpenDetail }: RowProps) {
  const [pending, startTransition] = useTransition();

  function handleStatusChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value;
    startTransition(async () => {
      await updateWaitlistStatus({
        id: row.id,
        status: next as (typeof STATUS_OPTIONS)[number]['value'],
      });
    });
  }

  return (
    <div
      data-mc-card
      className="space-y-3 rounded-lg border border-[var(--mc-accent-soft)]/30 bg-card/40 p-4"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-0.5 min-w-0">
          <div className="font-medium truncate">{row.name}</div>
          <div className="text-caption text-muted-foreground font-mono truncate">
            {row.email}
          </div>
        </div>
        <StatusBadge status={row.status} />
      </div>

      <div className="grid grid-cols-2 gap-2 text-caption">
        <div>
          <span
            data-mc-label
            className="text-muted-foreground uppercase tracking-wider"
          >
            Região:
          </span>{' '}
          {row.state ?? '—'}
          {row.city ? ` · ${row.city}` : ''}
        </div>
        <div>
          <span
            data-mc-label
            className="text-muted-foreground uppercase tracking-wider"
          >
            Uso:
          </span>{' '}
          {ROLE_LABELS[row.role] ?? row.role}
        </div>
        <div>
          <span
            data-mc-label
            className="text-muted-foreground uppercase tracking-wider"
          >
            Bambu:
          </span>{' '}
          <span data-mc-num className="font-mono">
            {row.bambuCount}
          </span>
        </div>
        <div>
          <span
            data-mc-label
            className="text-muted-foreground uppercase tracking-wider"
          >
            Criado:
          </span>{' '}
          <span data-mc-num>{formatDate(row.createdAt)}</span>
        </div>
      </div>

      <Select
        value={row.status}
        onChange={handleStatusChange}
        disabled={pending}
      >
        {STATUS_OPTIONS.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </Select>

      <div className="flex flex-wrap items-center gap-1">
        <ContactButtons row={row} />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onOpenDetail}
          className="ml-auto"
        >
          Detalhes
        </Button>
      </div>
    </div>
  );
}

function ContactButtons({ row }: { row: WaitlistRow }) {
  const buttons: React.ReactNode[] = [];
  if (row.phone) {
    const digits = row.phone.replace(/\D/g, '');
    buttons.push(
      <Button
        key="wa"
        asChild
        variant="ghost"
        size="icon"
        title={`WhatsApp · ${row.phone}`}
        className="size-7"
      >
        <a
          href={`https://wa.me/${digits.startsWith('55') ? digits : `55${digits}`}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <MessageCircle className="size-3.5" aria-hidden="true" />
        </a>
      </Button>,
    );
  }
  buttons.push(
    <Button
      key="mail"
      asChild
      variant="ghost"
      size="icon"
      title={`Email · ${row.email}`}
      className="size-7"
    >
      <a href={`mailto:${row.email}`}>
        <Mail className="size-3.5" aria-hidden="true" />
      </a>
    </Button>,
  );
  return <>{buttons}</>;
}
