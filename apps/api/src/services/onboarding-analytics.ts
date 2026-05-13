import { onboardingEvents } from '@printstudio/db';
import type { OnboardingEventType } from '@printstudio/shared';
import { db } from '../db.js';
import { logger } from '../logger.js';

/**
 * Fire-and-forget tracker server-side (Story 8.10).
 *
 * Usado pelo service createUserWithOrg pra disparar `signup_completed`
 * dentro da mesma transação (ver decisão em signup.ts). Async mas
 * com try/catch — falha não propaga.
 *
 * NÃO armazenar PII no metadata.
 */
export async function trackOnboardingEvent(
  organizationId: string,
  eventType: OnboardingEventType,
  metadata?: Record<string, unknown>,
): Promise<void> {
  try {
    await db.insert(onboardingEvents).values({
      organizationId,
      eventType,
      metadata: metadata ?? null,
    });
  } catch (err) {
    logger.warn(
      {
        event: 'onboarding.analytics_failed',
        type: eventType,
        organizationId,
        err: (err as Error).message,
      },
      'tracking event failed',
    );
  }
}
