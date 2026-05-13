import type { Metadata } from 'next';
import { LandingPageClient } from './_components/landing-page-client';

export const metadata: Metadata = {
  title: 'GuiaPrint3D · Monitore suas Bambu Lab A1 de qualquer lugar',
  description:
    'Mission Control cloud-nativo pra Bambu Lab A1. Telemetria em tempo real, multi-impressora, histórico e alertas — sem bridge na LAN.',
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    url: 'https://guiaprint3d.com',
    siteName: 'GuiaPrint3D',
    title: 'GuiaPrint3D · Mission Control pra Bambu Lab A1',
    description:
      'Monitore suas Bambu Lab A1 de qualquer lugar. Cloud-nativo, multi-impressora, telemetria em tempo real.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'GuiaPrint3D — Mission Control pra Bambu Lab A1',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'GuiaPrint3D · Mission Control pra Bambu Lab A1',
    description: 'Monitore suas Bambu Lab A1 de qualquer lugar.',
    images: ['/og-image.png'],
  },
};

/**
 * Landing page principal — Story 7.2.
 * Server Component que delega a parte interativa pro LandingPageClient.
 */
export default function HomePage() {
  return <LandingPageClient />;
}
