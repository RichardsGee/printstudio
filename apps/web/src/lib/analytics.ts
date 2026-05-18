/**
 * Analytics GA4 — Story 7.7 AC 6/8 (substitui o placeholder console.log
 * da Story 7.5).
 *
 * Gating de consentimento (LGPD): `window.gtag` só é definido por
 * `initGa()`, que o componente <Analytics/> só chama APÓS consent
 * `granted`. Logo `trackEvent`/`trackPageView` são no-op silencioso
 * enquanto não há consentimento — nenhum hit sai pro Google antes.
 *
 * `send_page_view: false` no config porque a landing é SPA: o
 * <Analytics/> dispara `page_view` manualmente a cada mudança de
 * pathname (inclui o push pra /sucesso).
 */
export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

export type AnalyticsEvent =
  | 'cta_waitlist_click'
  | 'demo_modal_open'
  | 'waitlist_step_advance'
  | 'waitlist_signup_success';

type GtagFn = (...args: unknown[]) => void;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: GtagFn;
  }
}

export function isGaReady(): boolean {
  return (
    typeof window !== 'undefined' &&
    !!GA_MEASUREMENT_ID &&
    typeof window.gtag === 'function'
  );
}

/**
 * Define `window.gtag` + dataLayer e empilha js/config. Idempotente.
 * Chamado só pelo <Analytics/> quando consent === 'granted'.
 */
export function initGa(): void {
  if (typeof window === 'undefined' || !GA_MEASUREMENT_ID) return;
  if (typeof window.gtag === 'function') return;
  window.dataLayer = window.dataLayer ?? [];
  const gtag: GtagFn = (...args) => {
    window.dataLayer!.push(args);
  };
  window.gtag = gtag;
  gtag('js', new Date());
  gtag('config', GA_MEASUREMENT_ID, { send_page_view: false });
}

export function trackPageView(path: string): void {
  if (!isGaReady()) return;
  window.gtag!('event', 'page_view', { page_path: path });
}

export function trackEvent(
  event: AnalyticsEvent,
  params?: Record<string, string | number | boolean | undefined>,
): void {
  if (!isGaReady()) return;
  window.gtag!('event', event, params ?? {});
}
