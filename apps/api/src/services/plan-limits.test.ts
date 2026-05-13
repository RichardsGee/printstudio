import { describe, it, expect, beforeEach } from 'vitest';
import {
  canAddPrintersFor,
  getPlanLimits,
  isPlanKey,
  PLAN_LIMITS,
} from '@printstudio/shared';
import {
  canAddPrinter,
  getOrgPlan,
  getOrgPlanLimits,
  getRetentionDays,
  canUseWebhooks,
  invalidatePlanCache,
} from './plan-limits.js';

/**
 * Tests do módulo plan-limits (Story 8.6).
 *
 * - Schema puro (`@printstudio/shared`) testado direto
 * - Service async (`apps/api`) testado com mock minimal de DB
 */

describe('@printstudio/shared plans', () => {
  it('PLAN_LIMITS tem as 3 chaves esperadas', () => {
    expect(PLAN_LIMITS.free).toBeDefined();
    expect(PLAN_LIMITS.pro).toBeDefined();
    expect(PLAN_LIMITS.business).toBeDefined();
  });

  it('isPlanKey valida corretamente', () => {
    expect(isPlanKey('free')).toBe(true);
    expect(isPlanKey('pro')).toBe(true);
    expect(isPlanKey('business')).toBe(true);
    expect(isPlanKey('enterprise')).toBe(false);
    expect(isPlanKey(null)).toBe(false);
    expect(isPlanKey(undefined)).toBe(false);
    expect(isPlanKey('')).toBe(false);
  });

  it('getPlanLimits fail-safe pra free em valor inválido', () => {
    expect(getPlanLimits('enterprise')).toEqual(PLAN_LIMITS.free);
    expect(getPlanLimits(null)).toEqual(PLAN_LIMITS.free);
    expect(getPlanLimits(undefined)).toEqual(PLAN_LIMITS.free);
  });

  it('getPlanLimits retorna correto pra cada plano', () => {
    expect(getPlanLimits('free').maxPrinters).toBe(1);
    expect(getPlanLimits('pro').maxPrinters).toBe(5);
    expect(getPlanLimits('business').maxPrinters).toBe(999);
    expect(getPlanLimits('free').retentionDays).toBe(7);
    expect(getPlanLimits('pro').retentionDays).toBe(30);
    expect(getPlanLimits('free').webhooks).toBe(false);
    expect(getPlanLimits('pro').webhooks).toBe(true);
  });

  describe('canAddPrintersFor', () => {
    it('free: 0 + 1 OK', () => {
      const r = canAddPrintersFor('free', 0, 1);
      expect(r.allowed).toBe(true);
      expect(r.limit).toBe(1);
      expect(r.remaining).toBe(1);
    });

    it('free: 1 + 1 BLOQUEADO', () => {
      const r = canAddPrintersFor('free', 1, 1);
      expect(r.allowed).toBe(false);
      expect(r.remaining).toBe(0);
    });

    it('free: 0 + 2 BLOQUEADO (não cabe nada além do limite)', () => {
      const r = canAddPrintersFor('free', 0, 2);
      expect(r.allowed).toBe(false);
    });

    it('pro: 4 + 1 OK (limite=5)', () => {
      expect(canAddPrintersFor('pro', 4, 1).allowed).toBe(true);
    });

    it('pro: 5 + 1 BLOQUEADO', () => {
      expect(canAddPrintersFor('pro', 5, 1).allowed).toBe(false);
    });

    it('business: 100 + 1 OK', () => {
      expect(canAddPrintersFor('business', 100, 1).allowed).toBe(true);
    });

    it('plan inválido cai em free (fail safe)', () => {
      expect(canAddPrintersFor('enterprise', 1, 1).allowed).toBe(false);
    });
  });
});

/**
 * Mock minimal do drizzle DB. Simula uma única tabela query por chain.
 * Cursor é controlado pelos testes pra retornar plan ou count.
 */
interface FakeStep {
  kind: 'plan' | 'count';
  value: unknown;
}

function makeFakeDb(steps: FakeStep[]) {
  let cursor = 0;
  return {
    select: (_cols?: unknown) => ({
      from: (_table: unknown) => {
        const chain = {
          where: () => chain,
          limit: () => Promise.resolve(consumeStep(steps, () => cursor++).result),
          // pra .from().where() sem .limit (canAddPrinter usa count)
          then: (resolve: (v: unknown) => void) => {
            const { result } = consumeStep(steps, () => cursor++);
            resolve(result);
          },
        };
        return chain;
      },
    }),
  } as never;
}

function consumeStep(steps: FakeStep[], advance: () => number) {
  const i = advance();
  const step = steps[i];
  if (!step) throw new Error(`no more steps configured (cursor=${i})`);
  if (step.kind === 'plan') {
    return { result: Array.isArray(step.value) ? step.value : [{ plan: step.value }] };
  }
  return { result: [{ count: step.value }] };
}

describe('apps/api plan-limits service', () => {
  const orgId = '11111111-1111-1111-1111-111111111111';

  beforeEach(() => {
    invalidatePlanCache(orgId);
  });

  it('getOrgPlan retorna plan do DB', async () => {
    const fake = makeFakeDb([{ kind: 'plan', value: 'pro' }]);
    const plan = await getOrgPlan(orgId, fake);
    expect(plan).toBe('pro');
  });

  it('getOrgPlan fallback free pra plan inválido no DB', async () => {
    const fake = makeFakeDb([{ kind: 'plan', value: 'enterprise' }]);
    const plan = await getOrgPlan(orgId, fake);
    expect(plan).toBe('free');
  });

  it('getOrgPlan fallback free se org não encontrada', async () => {
    const fake = makeFakeDb([{ kind: 'plan', value: [] }]);
    const plan = await getOrgPlan(orgId, fake);
    expect(plan).toBe('free');
  });

  it('getOrgPlan usa cache em segunda chamada (sem hit no DB)', async () => {
    const fake = makeFakeDb([{ kind: 'plan', value: 'business' }]);
    const first = await getOrgPlan(orgId, fake);
    // Se cache não funcionar, segunda chamada vai dar throw "no more steps"
    const second = await getOrgPlan(orgId, fake);
    expect(first).toBe('business');
    expect(second).toBe('business');
  });

  it('invalidatePlanCache força re-query', async () => {
    const fake1 = makeFakeDb([{ kind: 'plan', value: 'free' }]);
    await getOrgPlan(orgId, fake1);
    invalidatePlanCache(orgId);
    const fake2 = makeFakeDb([{ kind: 'plan', value: 'pro' }]);
    const plan = await getOrgPlan(orgId, fake2);
    expect(plan).toBe('pro');
  });

  it('getOrgPlanLimits retorna PlanLimits completos', async () => {
    const fake = makeFakeDb([{ kind: 'plan', value: 'pro' }]);
    const limits = await getOrgPlanLimits(orgId, fake);
    expect(limits.maxPrinters).toBe(5);
    expect(limits.webhooks).toBe(true);
  });

  it('getRetentionDays retorna dias do plano', async () => {
    const fake = makeFakeDb([{ kind: 'plan', value: 'business' }]);
    const days = await getRetentionDays(orgId, fake);
    expect(days).toBe(365);
  });

  it('canUseWebhooks: free=false', async () => {
    const fake = makeFakeDb([{ kind: 'plan', value: 'free' }]);
    expect(await canUseWebhooks(orgId, fake)).toBe(false);
  });

  it('canUseWebhooks: pro=true', async () => {
    const fake = makeFakeDb([{ kind: 'plan', value: 'pro' }]);
    expect(await canUseWebhooks(orgId, fake)).toBe(true);
  });

  describe('canAddPrinter', () => {
    it('free + 0 printers atuais → allowed', async () => {
      const fake = makeFakeDb([
        { kind: 'plan', value: 'free' },
        { kind: 'count', value: 0 },
      ]);
      const r = await canAddPrinter(orgId, 1, fake);
      expect(r.allowed).toBe(true);
      expect(r.plan).toBe('free');
      expect(r.limit).toBe(1);
      expect(r.reason).toBeUndefined();
    });

    it('free + 1 printer atual → bloqueado com reason amigável', async () => {
      const fake = makeFakeDb([
        { kind: 'plan', value: 'free' },
        { kind: 'count', value: 1 },
      ]);
      const r = await canAddPrinter(orgId, 1, fake);
      expect(r.allowed).toBe(false);
      expect(r.reason).toContain('Free permite 1');
      expect(r.remaining).toBe(0);
    });

    it('pro + 5 printers atuais → bloqueado', async () => {
      const fake = makeFakeDb([
        { kind: 'plan', value: 'pro' },
        { kind: 'count', value: 5 },
      ]);
      const r = await canAddPrinter(orgId, 1, fake);
      expect(r.allowed).toBe(false);
      expect(r.reason).toContain('5');
    });
  });
});
