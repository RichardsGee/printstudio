/**
 * Plan limits — Story 8.6.
 *
 * Source of truth pros limites de cada plano comercial. Reusável por
 * apps/api (enforcement em endpoints), apps/web (UI feedback) e
 * apps/worker (retention cleanup).
 *
 * Decisões fechadas (PRD 6/8):
 * - Free: 1 impressora, 7d retenção, sem webhooks, 1 user
 * - Pro: 5 impressoras, 30d retenção, webhooks, 3 users
 * - Business: 999 (~ilimitado), 365d retenção, webhooks, 999 users
 */

export const PLAN_KEYS = ['free', 'pro', 'business'] as const;
export type PlanKey = (typeof PLAN_KEYS)[number];

export interface PlanLimits {
  /** Máximo de impressoras vinculadas por organização. */
  maxPrinters: number;
  /** Dias de retenção de eventos/temperature_samples/print_jobs. */
  retentionDays: number;
  /** Permite criar webhooks (Epic futuro). */
  webhooks: boolean;
  /** Máximo de membros por organização (V1.1 quando invite member entrar). */
  maxUsers: number;
}

export const PLAN_LIMITS: Record<PlanKey, PlanLimits> = {
  free: {
    maxPrinters: 1,
    retentionDays: 7,
    webhooks: false,
    maxUsers: 1,
  },
  pro: {
    maxPrinters: 5,
    retentionDays: 30,
    webhooks: true,
    maxUsers: 3,
  },
  business: {
    maxPrinters: 999,
    retentionDays: 365,
    webhooks: true,
    maxUsers: 999,
  },
} as const;

const PLAN_KEY_SET = new Set<string>(PLAN_KEYS);

export function isPlanKey(value: string | null | undefined): value is PlanKey {
  return typeof value === 'string' && PLAN_KEY_SET.has(value);
}

/**
 * Resolve limites do plano. Se plano desconhecido (DB inconsistente,
 * migration nova, etc), retorna limites do free — fail safe.
 */
export function getPlanLimits(plan: string | null | undefined): PlanLimits {
  if (isPlanKey(plan)) return PLAN_LIMITS[plan];
  return PLAN_LIMITS.free;
}

/**
 * Avalia se org pode adicionar mais N impressoras baseado no plano.
 * `currentCount` é o número atual de printers; `incoming` é quanto
 * pretende adicionar.
 */
export function canAddPrintersFor(
  plan: string | null | undefined,
  currentCount: number,
  incoming: number,
): { allowed: boolean; limit: number; remaining: number } {
  const { maxPrinters } = getPlanLimits(plan);
  const remaining = Math.max(0, maxPrinters - currentCount);
  return {
    allowed: currentCount + incoming <= maxPrinters,
    limit: maxPrinters,
    remaining,
  };
}
