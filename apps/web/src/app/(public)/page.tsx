import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { LandingPageClient } from './_components/landing-page-client';

export const metadata: Metadata = {
  title: 'GuiaPrint3D · Monitore suas Bambu Lab A1 de qualquer lugar',
  description:
    'Mission Control cloud-nativo pra Bambu Lab A1. Telemetria em tempo real, multi-impressora, histórico e alertas — sem bridge na LAN.',
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    siteName: 'GuiaPrint3D',
    title: 'GuiaPrint3D · Mission Control pra Bambu Lab A1',
    description:
      'Monitore suas Bambu Lab A1 de qualquer lugar. Cloud-nativo, multi-impressora, telemetria em tempo real.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'GuiaPrint3D · Mission Control pra Bambu Lab A1',
    description: 'Monitore suas Bambu Lab A1 de qualquer lugar.',
  },
};

/**
 * Rota `/` — Story 7.7 AC 1.
 *
 * Substitui o antigo `app/page.tsx` (que redirecionava anônimo →
 * `/login`, deixando a landing inacessível ao público). Agora:
 * - Logado  → `/dashboard` (comportamento preservado)
 * - Anônimo → renderiza a landing completa (Hero + Features + Waitlist)
 *
 * Server Component: o `auth()` lê a sessão server-side; a parte
 * interativa fica no LandingPageClient ('use client').
 */
export default async function PublicHomePage() {
  const session = await auth();
  if (session?.user) redirect('/dashboard');
  return <LandingPageClient />;
}
