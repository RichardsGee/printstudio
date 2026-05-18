/**
 * Estado de consentimento de cookies/analytics — Story 7.7 AC 7 (LGPD).
 *
 * Armazenado em localStorage (`printstudio_consent`). Enquanto não há
 * decisão (`null`), GA4 NÃO carrega. `granted` libera, `denied` bloqueia
 * permanentemente (até o usuário limpar storage).
 *
 * `storeConsent` dispara um CustomEvent pra o componente <Analytics/>
 * reagir na hora (sem reload) quando o usuário clica Aceitar/Recusar.
 */
export const CONSENT_KEY = 'printstudio_consent';
export const CONSENT_EVENT = 'printstudio:consent-change';

export type ConsentState = 'granted' | 'denied';

export function getStoredConsent(): ConsentState | null {
  if (typeof window === 'undefined') return null;
  try {
    const v = window.localStorage.getItem(CONSENT_KEY);
    return v === 'granted' || v === 'denied' ? v : null;
  } catch {
    return null;
  }
}

export function storeConsent(state: ConsentState): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(CONSENT_KEY, state);
  } catch {
    // localStorage indisponível (Safari private) — ignora
  }
  window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: state }));
}
