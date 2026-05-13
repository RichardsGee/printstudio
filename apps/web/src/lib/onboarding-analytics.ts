import { createDb, onboardingEvents } from '@printstudio/db';
import type { OnboardingEventType } from '@printstudio/shared';

/**
 * Fire-and-forget tracker de eventos do onboarding (Story 8.10).
 *
 * Não bloqueia o caller: se DB falhar, loga via console.error mas
 * retorna ok pra UX não quebrar. Server actions do onboarding chamam
 * sem await (ou com await mas com try/catch interno).
 *
 * IMPORTANTE: NUNCA passar PII no `metadata`. Source-of-truth do
 * relacionamento user→org já é a tabela organizations; o evento é
 * sobre org, não pessoa.
 */
export async function trackOnboardingEvent(
  organizationId: string,
  eventType: OnboardingEventType,
  metadata?: Record<string, unknown>,
): Promise<void> {
  try {
    const url = process.env.DATABASE_URL;
    if (!url) {
      console.warn('[onboarding-analytics] DATABASE_URL not set — skipping event', eventType);
      return;
    }
    const db = createDb(url);
    await db.insert(onboardingEvents).values({
      organizationId,
      eventType,
      metadata: metadata ?? null,
    });
  } catch (err) {
    console.error('[onboarding-analytics] failed to track event', {
      eventType,
      organizationId,
      err: err instanceof Error ? err.message : String(err),
    });
  }
}
