import Link from 'next/link';
import { redirect } from 'next/navigation';
import { LayoutDashboard, History, Bell, Printer, LogOut } from 'lucide-react';
import { auth, signOut } from '@/lib/auth';
import { DualModeIndicator } from '@/components/dual-mode-indicator';
import { Button } from '@/components/ui/button';

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/history', label: 'Histórico', icon: History },
  { href: '/events', label: 'Eventos', icon: Bell },
];

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect('/login');

  return (
    <div className="min-h-dvh flex flex-col">
      <header className="border-b border-border bg-card/30 h-14 flex items-center gap-6 px-6 shrink-0">
        <Link href="/dashboard" className="flex items-center gap-2 shrink-0">
          <Printer className="h-5 w-5 text-primary" />
          <span className="font-semibold tracking-tight">PrintStudio</span>
        </Link>

        <nav className="flex items-center gap-1">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-4">
          <DualModeIndicator />
          <span className="text-xs text-muted-foreground hidden sm:inline truncate max-w-[180px]">
            {session.user.email}
          </span>
          <form
            action={async () => {
              'use server';
              await signOut({ redirectTo: '/login' });
            }}
          >
            <Button variant="ghost" size="sm">
              <LogOut className="h-4 w-4" />
              <span className="sr-only">Sair</span>
            </Button>
          </form>
        </div>
      </header>

      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
