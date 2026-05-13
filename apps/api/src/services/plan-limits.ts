import { eq, sql } from 'drizzle-orm';
import { organizations, printers } from '@printstudio/db';
import {
  canAddPrintersFor,
  getPlanLimits,
  type PlanKey,
  type PlanLimits,
} from '@printstudio/shared';
import { db, type Db } from '../db.js';

/**
 * Service de plan limits server-side (Story 8.6).
 *
 * Source of truth: `organizations.plan`. Cache em memória 60s evita
 * query repetida em endpoints quentes (POST /api/printers, list, etc).
 *
 * Cache miss em concorrência é aceitável — vamos no DB no pior caso.
 */

interface CacheEntry {
  plan: PlanKey;
  expiresAt: number;
}

const PLAN_TTL_MS = 60 * 1000; // 60s
const cache = new Map<string, CacheEntry>();

/**
 * Invalida cache de uma org. Chamar quando `organizations.plan` mudar
 * (Epic 6 — Asaas webhook plan_changed). NO-OP se entry não existe.
 */
export function invalidatePlanCache(orgId: string): void {
  cache.delete(orgId);
}

/**
 * Resolve o plano da org via cache (60s TTL) → DB.
 *
 * Se org não encontrada ou plan inválido, retorna 'free' (fail safe —
 * usuário com state inconsistente perde feature, não ganha bypass).
 */
export async function getOrgPlan(
  orgId: string,
  database: Db = db,
): Promise<PlanKey> {
  const now = Date.now();
  const cached = cache.get(orgId);
  if (cached && cached.expiresAt > now) {
    return cached.plan;
  }

  const rows = await database
    .select({ plan: organizations.plan })
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1);

  const rawPlan = rows[0]?.plan ?? 'free';
  const plan: PlanKey =
    rawPlan === 'pro' || rawPlan === 'business' ? rawPlan : 'free';

  cache.set(orgId, { plan, expiresAt: now + PLAN_TTL_MS });
  return plan;
}

/**
 * Retorna o objeto `PlanLimits` completo da org (atalho).
 */
export async function getOrgPlanLimits(
  orgId: string,
  database: Db = db,
): Promise<PlanLimits> {
  const plan = await getOrgPlan(orgId, database);
  return getPlanLimits(plan);
}

export interface CanAddPrinterResult {
  allowed: boolean;
  plan: PlanKey;
  limit: number;
  remaining: number;
  /** Mensagem amigável pra UI em caso de bloqueio. */
  reason?: string;
}

/**
 * Verifica se org pode adicionar `incoming` impressoras (default 1).
 * Conta impressoras atuais da org via COUNT(*).
 */
export async function canAddPrinter(
  orgId: string,
  incoming = 1,
  database: Db = db,
): Promise<CanAddPrinterResult> {
  const plan = await getOrgPlan(orgId, database);

  const rows = await database
    .select({ count: sql<number>`count(*)::int` })
    .from(printers)
    .where(eq(printers.organizationId, orgId));
  const currentCount = rows[0]?.count ?? 0;

  const check = canAddPrintersFor(plan, currentCount, incoming);

  if (check.allowed) {
    return {
      allowed: true,
      plan,
      limit: check.limit,
      remaining: check.remaining,
    };
  }

  const reason =
    plan === 'free'
      ? `Plano Free permite ${check.limit} impressora. Faça upgrade pra adicionar mais.`
      : `Você atingiu o limite de ${check.limit} impressoras do plano ${plan}.`;

  return {
    allowed: false,
    plan,
    limit: check.limit,
    remaining: check.remaining,
    reason,
  };
}

/**
 * Atalho pra retention days. Útil pra queries de history filtrarem
 * automaticamente baseado no plano.
 */
export async function getRetentionDays(
  orgId: string,
  database: Db = db,
): Promise<number> {
  const limits = await getOrgPlanLimits(orgId, database);
  return limits.retentionDays;
}

/**
 * Atalho pra checagem de webhooks (Epic futuro).
 */
export async function canUseWebhooks(
  orgId: string,
  database: Db = db,
): Promise<boolean> {
  const limits = await getOrgPlanLimits(orgId, database);
  return limits.webhooks;
}
