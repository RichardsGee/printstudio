import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';

/**
 * Layout do modo kiosk — sem header, sem nav, fullscreen.
 * Pensado para monitor de parede / tablet fixo. Mantém auth
 * (sessão de 30 dias do NextAuth absorve a falta de relogin).
 */
export default async function KioskLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect('/login?callbackUrl=/kiosk');

  return <div className="min-h-dvh bg-background">{children}</div>;
}
