import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { AppHeader } from '@/components/app-header';
import { NoBambuBanner } from '@/components/no-bambu-banner';

/**
 * Layout do modo kiosk — header global + área fullscreen pro grid de
 * impressoras. Pensado pra monitor de parede / tablet fixo.
 *
 * O tema Mission Control é aplicado globalmente via <body class="kiosk-mission">
 * em app/layout.tsx — não precisa wrapper extra aqui.
 */
export default async function KioskLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect('/login?callbackUrl=/kiosk');

  return (
    <div className="min-h-dvh flex flex-col">
      <AppHeader userEmail={session.user.email} />
      <NoBambuBanner />
      <main className="flex-1">{children}</main>
    </div>
  );
}
