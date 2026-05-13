import type { Metadata } from 'next';
import { PageHeader } from '@/components/ui/page-header';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { getAdminMetrics } from '@/lib/admin-metrics-queries';
import { FunnelChart } from './_components/funnel-chart';
import { SignupsLineChart } from './_components/signups-line-chart';

export const metadata: Metadata = {
  title: 'Admin · Métricas · PrintStudio',
  robots: { index: false, follow: false },
};

const PLAN_LABELS: Record<string, string> = {
  free: 'Free',
  pro: 'Pro',
  business: 'Business',
};

const STATUS_LABELS: Record<string, string> = {
  new: 'New',
  contacted: 'Contactado',
  engaged: 'Engaged',
  invited: 'Invited',
  converted: 'Convertido',
  lost: 'Lost',
};

/**
 * `/admin/metrics` (Story 9.8) — escopo V1.
 *
 * V1 entrega métricas computáveis com dados que já existem:
 * - KPIs básicos (signups, leads, orgs, printers, conversão)
 * - Funil onboarding (consome onboarding_events da Story 8.10)
 * - Signups por dia (últimos 30d)
 * - Distribuição plano + UF + status waitlist
 *
 * V1.1 / dependente de outras stories:
 * - DAU/WAU/MAU (precisa users.last_activity_at — Story 9.5)
 * - MRR / Churn / Conversion free→paid (precisa Epic 6 Asaas)
 * - Filtros range/plano/região
 */
export default async function AdminMetricsPage() {
  const m = await getAdminMetrics();

  const totalSignupCompleted = m.onboardingFunnel.find(
    (e) => e.event === 'signup_completed',
  )?.count ?? 0;
  const totalOnboardingFinished =
    (m.onboardingFunnel.find((e) => e.event === 'printers_added')?.count ?? 0) +
    (m.onboardingFunnel.find((e) => e.event === 'printers_skipped')?.count ?? 0) +
    (m.onboardingFunnel.find((e) => e.event === 'bambu_skipped')?.count ?? 0);
  const onboardingCompletionPct =
    totalSignupCompleted > 0
      ? (totalOnboardingFinished / totalSignupCompleted) * 100
      : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        id="ADMIN-METRICS"
        title="Métricas"
        description="Visão agregada do funil + base instalada. Refresh ao recarregar a página."
        showTimestamp={false}
      />

      <section
        aria-label="KPIs"
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
      >
        <KpiCard label="LEADS · WAITLIST" value={m.totalLeads} />
        <KpiCard
          label="USERS · SIGNUP"
          value={m.totalUsers}
          hint={
            m.totalLeads > 0
              ? `${(m.conversionWaitlistToSignup * 100).toFixed(1)}% conversion`
              : undefined
          }
        />
        <KpiCard
          label="ORGS · ONBOARDED"
          value={m.onboardedOrgs}
          hint={
            m.totalOrgs > 0
              ? `${(m.conversionSignupToOnboarded * 100).toFixed(1)}% conversion`
              : undefined
          }
        />
        <KpiCard label="IMPRESSORAS" value={m.totalPrinters} />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card data-mc-card>
          <CardHeader>
            <CardTitle className="text-body uppercase tracking-wider">
              Funil onboarding
            </CardTitle>
            <p className="text-caption text-muted-foreground">
              Drop-off por step. Conclusão geral:{' '}
              <span data-mc-num className="font-mono text-foreground">
                {onboardingCompletionPct.toFixed(1)}%
              </span>
            </p>
          </CardHeader>
          <CardContent>
            <FunnelChart data={m.onboardingFunnel} />
          </CardContent>
        </Card>

        <Card data-mc-card>
          <CardHeader>
            <CardTitle className="text-body uppercase tracking-wider">
              Signups · 30 dias
            </CardTitle>
            <p className="text-caption text-muted-foreground">
              Conta de eventos {`'signup_completed'`} por dia.
            </p>
          </CardHeader>
          <CardContent>
            <SignupsLineChart data={m.signupsLast30Days} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <DistributionCard
          title="Plano"
          data={m.byPlan}
          labels={PLAN_LABELS}
          colorize={(plan) =>
            plan === 'business'
              ? 'bg-primary'
              : plan === 'pro'
                ? 'bg-cyan-500/70'
                : 'bg-zinc-500/50'
          }
        />
        <DistributionCard
          title="Status waitlist"
          data={m.byWaitlistStatus}
          labels={STATUS_LABELS}
          colorize={(s) =>
            s === 'converted'
              ? 'bg-primary'
              : s === 'lost'
                ? 'bg-zinc-500/50'
                : 'bg-cyan-500/70'
          }
        />
        <Card data-mc-card>
          <CardHeader>
            <CardTitle className="text-body uppercase tracking-wider">
              Top regiões
            </CardTitle>
            <p className="text-caption text-muted-foreground">
              UFs com mais leads.
            </p>
          </CardHeader>
          <CardContent>
            {m.topStates.length === 0 ? (
              <p className="text-caption text-muted-foreground">
                Nenhum lead com UF.
              </p>
            ) : (
              <ul className="space-y-2">
                {m.topStates.map((s) => (
                  <li key={s.state} className="flex items-center justify-between text-small">
                    <span data-mc-label className="uppercase tracking-wider">
                      {s.state}
                    </span>
                    <span data-mc-num className="font-mono">
                      {s.count}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card data-mc-card>
        <CardHeader>
          <CardTitle className="text-body uppercase tracking-wider">
            Métricas avançadas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-small text-muted-foreground">
          <p>
            DAU/WAU/MAU dependem de tracking de atividade em
            <code className="mx-1 font-mono text-primary">users.last_activity_at</code>
            (chega na Story 9.5).
          </p>
          <p>
            MRR, Churn e Conversion free→paid dependem do Epic 6
            (Asaas Payments) entrar em produção.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint?: string;
}) {
  return (
    <Card data-mc-card>
      <CardHeader className="pb-2">
        <p
          data-mc-id
          className="text-caption font-mono uppercase tracking-wider text-muted-foreground"
        >
          {`// ${label}`}
        </p>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-2">
          <span data-mc-num className="text-3xl font-semibold">
            {value}
          </span>
          {hint && (
            <span className="text-caption text-muted-foreground">{hint}</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function DistributionCard({
  title,
  data,
  labels,
  colorize,
}: {
  title: string;
  data: Record<string, number>;
  labels: Record<string, string>;
  colorize: (key: string) => string;
}) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((sum, [, c]) => sum + c, 0);

  return (
    <Card data-mc-card>
      <CardHeader>
        <CardTitle className="text-body uppercase tracking-wider">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <p className="text-caption text-muted-foreground">Sem dados.</p>
        ) : (
          <ul className="space-y-2">
            {entries.map(([key, count]) => {
              const pct = (count / total) * 100;
              return (
                <li key={key} className="space-y-1">
                  <div className="flex items-center justify-between text-caption">
                    <span className="uppercase tracking-wider">
                      {labels[key] ?? key}
                    </span>
                    <span className="font-mono text-muted-foreground">
                      <span data-mc-num className="text-foreground">
                        {count}
                      </span>{' '}
                      · <span data-mc-num>{pct.toFixed(0)}%</span>
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-card/40">
                    <div
                      className={`h-full ${colorize(key)}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
