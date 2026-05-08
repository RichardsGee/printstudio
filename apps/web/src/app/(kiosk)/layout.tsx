import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import './kiosk-theme.css';

/**
 * Layout do modo kiosk — sem header, sem nav, fullscreen.
 * Pensado para monitor de parede / tablet fixo. Mantém auth
 * (sessão de 30 dias do NextAuth absorve a falta de relogin).
 *
 * Aplica o tema "Mission Mode" (kiosk-theme.css) — visual de
 * Mission Control com grid bg, scanlines, monospace, cyan accent.
 */
export default async function KioskLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect('/login?callbackUrl=/kiosk');

  return <div className="kiosk-mission min-h-dvh">{children}</div>;
}
