/**
 * Placeholder de analytics V1 — apenas console.log.
 * V2 integra Plausible/Umami/PostHog conforme decisão de produto.
 *
 * Story 7.5.
 */
export type AnalyticsEvent =
  | 'waitlist_signup_success'
  | 'demo_modal_open'
  | 'cta_waitlist_click';

export function trackEvent(
  event: AnalyticsEvent,
  properties?: Record<string, string | number | boolean | undefined>,
): void {
  if (typeof window === 'undefined') return;
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[analytics] ${event}`, properties ?? {});
  }
  // V2: window.plausible?.(event, { props: properties })
}
