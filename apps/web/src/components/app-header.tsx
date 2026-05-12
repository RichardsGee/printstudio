'use client';

import { useState } from 'react';
import Link from 'next/link';
import * as DialogPrimitive from '@radix-ui/react-dialog';
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
  Menu,
  X,
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
 *
 * Responsivo:
 * - Desktop (lg+): NAV horizontal inline
 * - Mobile/tablet (<lg): hamburger button + drawer lateral (Radix Dialog
 *   custom-styled como slide-in da esquerda)
 */
export function AppHeader({ userEmail }: AppHeaderProps) {
  const [navOpen, setNavOpen] = useState(false);

  return (
    <header className="border-b border-[var(--mc-accent-soft)]/40 bg-card/40 backdrop-blur h-14 flex items-center gap-3 sm:gap-6 px-4 sm:px-6 shrink-0">
      {/* Hamburger — só em mobile (<lg) */}
      <DialogPrimitive.Root open={navOpen} onOpenChange={setNavOpen}>
        <DialogPrimitive.Trigger asChild>
          <button
            type="button"
            aria-label="Abrir menu"
            className="lg:hidden inline-flex items-center justify-center h-11 w-11 -ml-2 text-foreground hover:bg-primary/10 transition-colors"
          >
            <Menu className="h-5 w-5" />
          </button>
        </DialogPrimitive.Trigger>

        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
          />
          <DialogPrimitive.Content
            className="fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] bg-card border-r border-[var(--mc-accent-soft)]/40 shadow-elev-3 p-4 flex flex-col gap-3 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left duration-200"
          >
            <DialogPrimitive.Title className="sr-only">Menu de navegação</DialogPrimitive.Title>

            {/* Header do drawer: logo + close */}
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-[var(--mc-accent-soft)]/30">
              <div className="flex items-center gap-2">
                <Printer className="h-5 w-5 text-primary" />
                <span
                  data-mc-label
                  className="font-semibold tracking-wider text-small"
                >
                  PRINTSTUDIO
                </span>
              </div>
              <DialogPrimitive.Close asChild>
                <button
                  type="button"
                  aria-label="Fechar menu"
                  className="inline-flex items-center justify-center h-9 w-9 text-muted-foreground hover:text-foreground hover:bg-primary/10 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </DialogPrimitive.Close>
            </div>

            {/* NAV vertical (touch targets >=44px) */}
            <nav className="flex flex-col gap-1 flex-1">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  data-mc-label
                  onClick={() => setNavOpen(false)}
                  className="flex items-center gap-3 border border-transparent hover:border-[var(--mc-accent-soft)]/50 px-3 h-11 text-small uppercase tracking-wider text-muted-foreground hover:bg-primary/10 hover:text-foreground transition-colors"
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </Link>
              ))}
            </nav>

            {/* Footer drawer: email + sair */}
            <div className="border-t border-[var(--mc-accent-soft)]/30 pt-3 space-y-2">
              {userEmail ? (
                <div
                  data-mc-id
                  className="text-caption text-muted-foreground truncate px-1"
                >
                  {`// ${userEmail}`}
                </div>
              ) : null}
              <form action={logoutAction}>
                <Button
                  type="submit"
                  variant="outline"
                  size="sm"
                  className="w-full uppercase tracking-wider h-11"
                >
                  <LogOut className="h-4 w-4 mr-1.5" />
                  Sair
                </Button>
              </form>
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      {/* Logo (sempre visível) */}
      <Link href="/dashboard" className="flex items-center gap-2 shrink-0">
        <Printer className="h-5 w-5 text-primary" />
        <span
          data-mc-label
          className="font-semibold tracking-wider text-small"
        >
          PRINTSTUDIO
        </span>
      </Link>

      {/* NAV horizontal — só em desktop (lg+) */}
      <nav className="hidden lg:flex items-center gap-1 overflow-x-auto">
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

      {/* Direita: DualMode + email (desktop) + sair (desktop) */}
      <div className="ml-auto flex items-center gap-2 sm:gap-4">
        <DualModeIndicator />
        {userEmail ? (
          <span
            data-mc-id
            className="text-caption text-muted-foreground hidden lg:inline truncate max-w-[180px]"
          >
            {`// ${userEmail}`}
          </span>
        ) : null}
        <form action={logoutAction} className="hidden lg:block">
          <Button variant="ghost" size="sm">
            <LogOut className="h-4 w-4" />
            <span className="sr-only">Sair</span>
          </Button>
        </form>
      </div>
    </header>
  );
}
