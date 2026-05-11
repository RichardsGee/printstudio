import Link from 'next/link';
import {
  LayoutDashboard,
  History,
  Bell,
  Printer,
  LogOut,
  Palette,
  Monitor,
  Cloud,
  Settings,
} from 'lucide-react';
import { DualModeIndicator } from '@/components/dual-mode-indicator';
import { Button } from '@/components/ui/button';
import { logoutAction } from '@/lib/auth-actions';

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/kiosk', label: 'Kiosk', icon: Monitor },
  { href: '/history', label: 'Histórico', icon: History },
  { href: '/events', label: 'Eventos', icon: Bell },
  { href: '/settings/printers', label: 'Impressoras', icon: Settings },
  { href: '/settings/bambu-connect', label: 'Bambu Cloud', icon: Cloud },
  { href: '/design-system', label: 'Design', icon: Palette },
];

interface AppHeaderProps {
  userEmail?: string | null;
}

/**
 * Header global do PrintStudio — logo + nav + indicador de modo +
 * email do usuário + sair. Compartilhado entre /app (rotas internas)
 * e /kiosk (modo monitor de parede).
 */
export function AppHeader({ userEmail }: AppHeaderProps) {
  return (
    <header className="border-b border-[var(--mc-accent-soft)]/40 bg-card/40 backdrop-blur h-14 flex items-center gap-6 px-6 shrink-0">
      <Link href="/dashboard" className="flex items-center gap-2 shrink-0">
        <Printer className="h-5 w-5 text-primary" />
        <span
          data-mc-label
          className="font-semibold tracking-wider text-small"
        >
          PRINTSTUDIO
        </span>
      </Link>

      <nav className="flex items-center gap-1 overflow-x-auto">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            data-mc-label
            className="flex items-center gap-1.5 border border-transparent hover:border-[var(--mc-accent-soft)]/50 px-3 py-1 text-caption uppercase tracking-wider text-muted-foreground hover:bg-primary/10 hover:text-foreground transition-colors shrink-0"
          >
            <item.icon className="h-3.5 w-3.5" />
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="ml-auto flex items-center gap-4">
        <DualModeIndicator />
        {userEmail ? (
          <span
            data-mc-id
            className="text-caption text-muted-foreground hidden sm:inline truncate max-w-[180px]"
          >
            {`// ${userEmail}`}
          </span>
        ) : null}
        <form action={logoutAction}>
          <Button variant="ghost" size="sm">
            <LogOut className="h-4 w-4" />
            <span className="sr-only">Sair</span>
          </Button>
        </form>
      </div>
    </header>
  );
}
