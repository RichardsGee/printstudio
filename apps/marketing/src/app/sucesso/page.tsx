import type { Metadata } from 'next';
import { SuccessPageClient } from './success-page-client';

export const metadata: Metadata = {
  title: 'Você está na lista · GuiaPrint3D',
  description: 'Cadastro confirmado na waitlist do GuiaPrint3D.',
  robots: { index: false, follow: false },
};

/**
 * Página de sucesso pós-submit do form de waitlist (Story 7.5).
 *
 * Decisões fechadas PRD 7:
 * - Mensagem simples V1 (sem CTAs de comunidade Telegram/WhatsApp — V1.1)
 * - Sem PII na URL (decisão por privacidade)
 * - noindex, nofollow (não vaza pra search results)
 *
 * Server Component delega tracking (client-only) pro SuccessPageClient.
 */
export default function SucessoPage() {
  return <SuccessPageClient />;
}
