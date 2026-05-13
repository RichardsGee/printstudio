import 'server-only';
import { sql } from 'drizzle-orm';
import {
  createDb,
  onboardingEvents,
  organizations,
  printers,
  users,
  waitlist,
} from '@printstudio/db';
import type { OnboardingEventType } from '@printstudio/shared';

let _db: ReturnType<typeof createDb> | null = null;
function getDb() {
  if (_db) return _db;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL not set');
  _db = createDb(url);
  return _db;
}

export interface AdminMetrics {
  totalUsers: number;
  totalLeads: number;
  totalOrgs: number;
  totalPrinters: number;
  /** Orgs com onboarding_completed_at != null (done OR skipped). */
  onboardedOrgs: number;
  /** Leads `status='converted'` / total leads. */
  conversionWaitlistToSignup: number;
  /** Orgs onboarded / total orgs. */
  conversionSignupToOnboarded: number;
  /** Distribuição por plano. */
  byPlan: Record<string, number>;
  /** Distribuição por status waitlist. */
  byWaitlistStatus: Record<string, number>;
  /** Top 5 UFs com mais leads. */
  topStates: Array<{ state: string; count: number }>;
  /** Signups por dia nos últimos 30d. Array com {date, count}. */
  signupsLast30Days: Array<{ date: string; count: number }>;
  /** Funil onboarding agregado (Story 8.10). */
  onboardingFunnel: Array<{ event: OnboardingEventType; count: number }>;
}

/**
 * Snapshot completo de métricas pro dashboard `/admin/metrics`
 * (Story 9.8 — escopo V1).
 *
 * O que NÃO inclui (depende de stories futuras):
 * - DAU/WAU/MAU (precisa `users.last_activity_at` — Story 9.5)
 * - MRR / Churn / Conversion free→paid (precisa Epic 6 Asaas)
 * - Filtros por range/plano/região (V1.1)
 *
 * Queries rodam em paralelo via Promise.all. Cada uma é indexed lookup
 * ou COUNT agregado.
 */
export async function getAdminMetrics(): Promise<AdminMetrics> {
  const db = getDb();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [
    usersRow,
    leadsRow,
    orgsRow,
    printersRow,
    onboardedRow,
    convertedLeadsRow,
    byPlanRows,
    byStatusRows,
    topStatesRows,
    signupsDailyRows,
    funnelRows,
  ] = await Promise.all([
    db.select({ c: sql<number>`count(*)::int` }).from(users),
    db.select({ c: sql<number>`count(*)::int` }).from(waitlist),
    db.select({ c: sql<number>`count(*)::int` }).from(organizations),
    db.select({ c: sql<number>`count(*)::int` }).from(printers),
    db
      .select({ c: sql<number>`count(*)::int` })
      .from(organizations)
      .where(sql`${organizations.onboardingCompletedAt} IS NOT NULL`),
    db
      .select({ c: sql<number>`count(*)::int` })
      .from(waitlist)
      .where(sql`${waitlist.status} = 'converted'`),
    db
      .select({ plan: organizations.plan, c: sql<number>`count(*)::int` })
      .from(organizations)
      .groupBy(organizations.plan),
    db
      .select({ status: waitlist.status, c: sql<number>`count(*)::int` })
      .from(waitlist)
      .groupBy(waitlist.status),
    db
      .select({ state: waitlist.state, c: sql<number>`count(*)::int` })
      .from(waitlist)
      .where(sql`${waitlist.state} IS NOT NULL`)
      .groupBy(waitlist.state)
      .orderBy(sql`count(*) DESC`)
      .limit(5),
    db
      .select({
        day: sql<string>`to_char(date_trunc('day', ${onboardingEvents.createdAt}), 'YYYY-MM-DD')`,
        c: sql<number>`count(*)::int`,
      })
      .from(onboardingEvents)
      .where(
        sql`${onboardingEvents.eventType} = 'signup_completed' AND ${onboardingEvents.createdAt} >= ${thirtyDaysAgo}`,
      )
      .groupBy(sql`date_trunc('day', ${onboardingEvents.createdAt})`)
      .orderBy(sql`date_trunc('day', ${onboardingEvents.createdAt}) ASC`),
    db
      .select({
        event: onboardingEvents.eventType,
        c: sql<number>`count(*)::int`,
      })
      .from(onboardingEvents)
      .groupBy(onboardingEvents.eventType),
  ]);

  const totalUsers = usersRow[0]?.c ?? 0;
  const totalLeads = leadsRow[0]?.c ?? 0;
  const totalOrgs = orgsRow[0]?.c ?? 0;
  const totalPrinters = printersRow[0]?.c ?? 0;
  const onboardedOrgs = onboardedRow[0]?.c ?? 0;
  const convertedLeads = convertedLeadsRow[0]?.c ?? 0;

  const byPlan: Record<string, number> = {};
  for (const r of byPlanRows) byPlan[r.plan] = r.c;

  const byWaitlistStatus: Record<string, number> = {};
  for (const r of byStatusRows) byWaitlistStatus[r.status] = r.c;

  return {
    totalUsers,
    totalLeads,
    totalOrgs,
    totalPrinters,
    onboardedOrgs,
    conversionWaitlistToSignup: totalLeads > 0 ? convertedLeads / totalLeads : 0,
    conversionSignupToOnboarded: totalOrgs > 0 ? onboardedOrgs / totalOrgs : 0,
    byPlan,
    byWaitlistStatus,
    topStates: topStatesRows.map((r) => ({ state: r.state ?? 'N/A', count: r.c })),
    signupsLast30Days: signupsDailyRows.map((r) => ({ date: r.day, count: r.c })),
    onboardingFunnel: funnelRows.map((r) => ({
      event: r.event as OnboardingEventType,
      count: r.c,
    })),
  };
}
