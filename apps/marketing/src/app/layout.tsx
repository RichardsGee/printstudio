import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import './mission-control.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'GuiaPrint3D · Monitore suas Bambu Lab A1 de qualquer lugar',
  description:
    'Mission Control pra impressoras Bambu Lab A1. Kiosk de parede, cloud nativo, multi-impressora, histórico em tempo real.',
  applicationName: 'GuiaPrint3D',
  icons: { icon: '/favicon.ico' },
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    title: 'GuiaPrint3D · Mission Control pra Bambu A1',
    description:
      'Monitore suas Bambu Lab A1 de qualquer lugar. Kiosk de parede + cloud + multi-impressora.',
    siteName: 'GuiaPrint3D',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'GuiaPrint3D · Mission Control pra Bambu A1',
    description: 'Monitore suas Bambu Lab A1 de qualquer lugar.',
  },
};

export const viewport: Viewport = {
  themeColor: '#050810',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

/**
 * Root layout do marketing site (story 7.1).
 *
 * Aplica tema Mission Control globalmente via <body class="kiosk-mission">
 * — mesmo padrão do apps/web (mission-control.css copiado V1, plano
 * extrair pra packages/ui em V1.1).
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className={inter.variable} suppressHydrationWarning>
      <body className="kiosk-mission min-h-dvh">{children}</body>
    </html>
  );
}
