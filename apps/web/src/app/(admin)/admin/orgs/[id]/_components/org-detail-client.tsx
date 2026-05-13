'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Shield } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { OrgFullDetail } from '@/lib/admin-org-detail-queries';
import { cn } from '@/lib/utils';
import { ChangePlanDialog } from './change-plan-dialog';

const TABS = [
  { id: 'info', label: 'Info' },
  { id: 'members', label: 'Members' },
  { id: 'printers', label: 'Printers' },
  { id: 'events', label: 'Eventos' },
] as const;

type TabId = (typeof TABS)[number]['id'];

const PLAN_BADGE: Record<string, string> = {
  free: 'border-zinc-500/40 bg-zinc-500/10 text-zinc-300',
  pro: 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300',
  business: 'border-primary/40 bg-primary/10 text-primary',
};

const SEVERITY_BADGE: Record<string, string> = {
  INFO: 'border-zinc-500/40 bg-zinc-500/10 text-zinc-300',
  WARN: 'border-warning/40 bg-warning/10 text-warning',
  ERROR: 'border-destructive/40 bg-destructive/10 text-destructive',
};

function formatDate(d: Date | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Detail completo de uma org (Story 9.6).
 *
 * Client component — toda lógica visual de tabs. Server Component pai
 * pré-fetch de tudo. Tabs custom (sem Radix Tabs) com state local.
 *
 * V1 entregue: Info + Members + Printers + Eventos.
 * V1.1 / dependentes: Subscription (Epic 6 Asaas), Audit (Story 9.9).
 */
export function OrgDetailClient({ detail }: { detail: OrgFullDetail }) {
  const [tab, setTab] = useState<TabId>('info');
  const { org, members, printers, recentEvents } = detail;

  return (
    <div className="space-y-6">
      <Link
        href="/admin/orgs"
        className="inline-flex items-center gap-1.5 text-caption font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3" aria-hidden="true" />
        Voltar pra lista
      </Link>

      <header className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <p
              data-mc-id
              className="text-caption font-mono uppercase tracking-wider text-primary"
            >
              {`// ORG · ${org.id.slice(0, 8)}`}
            </p>
            <h1 className="text-2xl font-semibold">{org.name}</h1>
          </div>
          <Badge
            variant="outline"
            className={cn(
              'font-mono uppercase tracking-wider',
              PLAN_BADGE[org.plan],
            )}
          >
            {org.plan}
          </Badge>
        </div>
        <p className="text-caption text-muted-foreground">
          Criada em {formatDate(org.createdAt)} · {members.length} member
          {members.length === 1 ? '' : 's'} · {printers.length} impressora
          {printers.length === 1 ? '' : 's'}
        </p>
      </header>

      <div className="border-b border-[var(--mc-accent-soft)]/30">
        <nav className="flex gap-1 overflow-x-auto" aria-label="Abas">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              aria-current={tab === t.id ? 'page' : undefined}
              className={cn(
                'shrink-0 border-b-2 px-3 py-2 text-caption uppercase tracking-wider transition-colors',
                tab === t.id
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {tab === 'info' && <InfoTab detail={detail} />}
      {tab === 'members' && <MembersTab members={members} />}
      {tab === 'printers' && <PrintersTab printers={printers} />}
      {tab === 'events' && <EventsTab events={recentEvents} />}
    </div>
  );
}

function InfoTab({ detail }: { detail: OrgFullDetail }) {
  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const { org } = detail;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card data-mc-card>
        <CardHeader>
          <CardTitle className="text-body uppercase tracking-wider">
            Dados da organização
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-small">
          <KV label="ID" value={org.id} mono />
          <KV label="NOME" value={org.name} />
          <KV label="PLANO" value={org.plan.toUpperCase()} mono />
          <KV
            label="ONBOARDING"
            value={
              org.onboardingCompletedAt
                ? `${org.onboardingStep} (em ${formatDate(org.onboardingCompletedAt)})`
                : org.onboardingStep
            }
          />
          <KV label="ROLE" value={org.role ?? '—'} />
          <KV
            label="REGIÃO"
            value={
              org.state
                ? `${org.state}${org.city ? ` · ${org.city}` : ''}`
                : '—'
            }
          />
          <KV label="CRIADA" value={formatDate(org.createdAt)} />
          <KV label="ATUALIZADA" value={formatDate(org.updatedAt)} />
        </CardContent>
      </Card>

      <Card data-mc-card>
        <CardHeader>
          <CardTitle className="text-body uppercase tracking-wider">
            Ações administrativas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <p className="text-small">
              <strong>Override de plano:</strong> força mudança de plano
              ignorando billing. Use só com justificativa documentada
              (compliance/cortesia).
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPlanDialogOpen(true)}
              className="gap-2"
            >
              <Shield className="size-3.5" aria-hidden="true" />
              Mudar plano (override)
            </Button>
          </div>

          <div className="space-y-1 rounded-md border border-muted/40 bg-card/40 p-3 text-caption text-muted-foreground">
            <p
              data-mc-id
              className="font-mono uppercase tracking-wider text-muted-foreground"
            >
              {'// PENDING · V1.1'}
            </p>
            <p>
              Suspender conta, soft-delete e sync Asaas pendem do Epic 6
              (billing) entrar + tabela admin_audit_log (Story 9.9).
            </p>
          </div>
        </CardContent>
      </Card>

      <ChangePlanDialog
        open={planDialogOpen}
        onOpenChange={setPlanDialogOpen}
        orgId={org.id}
        currentPlan={org.plan}
      />
    </div>
  );
}

function MembersTab({ members }: { members: OrgFullDetail['members'] }) {
  if (members.length === 0) {
    return <EmptyCard label="// NO MEMBERS" text="Org sem membros." />;
  }
  return (
    <Card data-mc-card>
      <CardContent className="p-0">
        <table className="w-full text-small">
          <thead className="bg-card/40 text-caption uppercase tracking-wider text-muted-foreground">
            <tr>
              <Th>Email</Th>
              <Th>Nome</Th>
              <Th>Role org</Th>
              <Th>Role user</Th>
              <Th>Joined</Th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr
                key={m.userId}
                className="border-t border-[var(--mc-accent-soft)]/20"
              >
                <Td>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-caption">{m.email}</span>
                    {m.isSuperAdmin && (
                      <Badge
                        variant="outline"
                        className="border-primary/40 bg-primary/10 text-caption text-primary"
                      >
                        SUPER
                      </Badge>
                    )}
                  </div>
                </Td>
                <Td>{m.name ?? '—'}</Td>
                <Td>
                  <Badge variant="outline" className="text-caption uppercase tracking-wider">
                    {m.memberRole}
                  </Badge>
                </Td>
                <Td>
                  <span className="font-mono text-caption">{m.userRole}</span>
                </Td>
                <Td>
                  <span data-mc-num className="font-mono text-caption text-muted-foreground">
                    {formatDate(m.joinedAt)}
                  </span>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function PrintersTab({ printers }: { printers: OrgFullDetail['printers'] }) {
  if (printers.length === 0) {
    return (
      <EmptyCard
        label="// NO PRINTERS"
        text="Nenhuma impressora cadastrada nesta org."
      />
    );
  }
  return (
    <Card data-mc-card>
      <CardContent className="p-0">
        <table className="w-full text-small">
          <thead className="bg-card/40 text-caption uppercase tracking-wider text-muted-foreground">
            <tr>
              <Th>Order</Th>
              <Th>Nome</Th>
              <Th>Model</Th>
              <Th>Serial</Th>
              <Th>Criada</Th>
            </tr>
          </thead>
          <tbody>
            {printers.map((p) => (
              <tr key={p.id} className="border-t border-[var(--mc-accent-soft)]/20">
                <Td>
                  <span data-mc-num className="font-mono">
                    {p.displayOrder ?? '—'}
                  </span>
                </Td>
                <Td>{p.name}</Td>
                <Td>
                  <span className="font-mono text-caption">{p.model}</span>
                </Td>
                <Td>
                  <code className="font-mono text-caption text-muted-foreground">
                    {p.serial}
                  </code>
                </Td>
                <Td>
                  <span data-mc-num className="font-mono text-caption text-muted-foreground">
                    {formatDate(p.createdAt)}
                  </span>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function EventsTab({ events }: { events: OrgFullDetail['recentEvents'] }) {
  if (events.length === 0) {
    return <EmptyCard label="// NO EVENTS" text="Sem eventos recentes." />;
  }
  return (
    <Card data-mc-card>
      <CardContent className="space-y-2 p-4">
        {events.map((e) => (
          <div
            key={e.id}
            className="flex items-start gap-3 border-b border-[var(--mc-accent-soft)]/10 pb-2 last:border-0 last:pb-0"
          >
            <Badge
              variant="outline"
              className={cn(
                'shrink-0 font-mono uppercase tracking-wider text-caption',
                SEVERITY_BADGE[e.severity] ?? '',
              )}
            >
              {e.severity}
            </Badge>
            <div className="min-w-0 flex-1 space-y-0.5">
              <p className="text-small">{e.message}</p>
              <p className="text-caption font-mono text-muted-foreground">
                {e.type}
                {e.printerId ? ` · ${e.printerId.slice(0, 8)}` : ''} ·{' '}
                <span data-mc-num>{formatDate(e.createdAt)}</span>
              </p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function KV({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline gap-2">
      <span
        data-mc-label
        className="w-24 shrink-0 text-caption font-mono uppercase tracking-wider text-muted-foreground"
      >
        {label}
      </span>
      <span className={cn('text-small break-all', mono && 'font-mono')}>
        {value}
      </span>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-3 py-2 text-left font-medium" data-mc-label>
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-3 py-2.5 align-top">{children}</td>;
}

function EmptyCard({ label, text }: { label: string; text: string }) {
  return (
    <div className="rounded-lg border border-[var(--mc-accent-soft)]/30 bg-card/40 p-8 text-center">
      <p
        data-mc-id
        className="text-caption font-mono uppercase tracking-wider text-muted-foreground"
      >
        {label}
      </p>
      <p className="mt-2 text-small text-muted-foreground">{text}</p>
    </div>
  );
}
